import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { IFilterAngularComp, IFloatingFilterAngularComp } from 'ag-grid-angular';
import {
  ColDef,
  IDoesFilterPassParams,
  IFilterParams,
  IFloatingFilterParams,
  TextFilterModel,
} from 'ag-grid-community';
import { AutoComplete, AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { DatePicker } from 'primeng/datepicker';
import { InputText } from 'primeng/inputtext';
import { Popover } from 'primeng/popover';
import { Observable } from 'rxjs';
import { APP_TODAY } from '../../core/api/mock-api';
import { StaffService } from '../../core/data/staff.service';
import { formatSum, isoToLocalDate, localDateToIso } from '../format/format';
import { SumInputDirective } from '../forms/sum-input.directive';
import { Icon } from '../ui/icon/icon';

/**
 * Фильтры столбцов таблиц HotelOS (строка фильтров под шапкой):
 * — сумма: диапазон «от … до …»;
 * — дата: период в календаре (сравниваются только дни, время не учитывается);
 * — «Кто оформил»: автодополнение по списку сотрудников из «Пользователей».
 * Подключение к столбцу: `...sumFilter()`, `...dateFilter()`, `...staffFilter()`.
 */

/** Модель диапазона: числа (сумма) или «YYYY-MM-DD» (дата); null — граница не задана. */
export interface RangeModel<V = number | string> {
  from: V | null;
  to: V | null;
}

type RangeMode = 'number' | 'date';

const isSet = (m: RangeModel | null): m is RangeModel => !!m && (m.from !== null || m.to !== null);

/**
 * Сам фильтр (без своего окна — управляется только из строки фильтров).
 * Значение берётся через getValue: у столбца — сырая сумма / ISO-дата (field, valueGetter
 * или filterValueGetter), форматирование — только в valueFormatter.
 */
@Component({
  selector: 'app-range-filter',
  template: '',
})
export class RangeFilter implements IFilterAngularComp {
  private params!: IFilterParams & { mode?: RangeMode };
  private model: RangeModel | null = null;

  agInit(params: IFilterParams & { mode?: RangeMode }): void {
    this.params = params;
  }

  isFilterActive(): boolean {
    return isSet(this.model);
  }

  doesFilterPass(p: IDoesFilterPassParams): boolean {
    const m = this.model;
    if (!isSet(m)) {
      return true;
    }
    const raw = this.params.getValue(p.node);
    if (this.params.mode === 'date') {
      const day = raw ? String(raw).slice(0, 10) : '';
      if (!day) {
        return false;
      }
      return (m.from === null || day >= String(m.from)) && (m.to === null || day <= String(m.to));
    }
    if (raw === null || raw === undefined || raw === '') {
      return false;
    }
    const n = Number(raw);
    return (m.from === null || n >= Number(m.from)) && (m.to === null || n <= Number(m.to));
  }

  getModel(): RangeModel | null {
    return isSet(this.model) ? this.model : null;
  }

  setModel(model: RangeModel | null): void {
    this.model = isSet(model) ? model : null;
  }

  /** Вызывается из строки фильтров. */
  apply(model: RangeModel | null): void {
    this.setModel(model);
    this.params.filterChangedCallback();
  }
}

/** Общая часть ячеек строки фильтров. */
abstract class FloatingBase<P> implements IFloatingFilterAngularComp<P> {
  protected params!: IFloatingFilterParams<P>;
  protected readonly label = signal('');

  agInit(params: IFloatingFilterParams<P>): void {
    this.params = params;
    this.label.set(params.column.getColDef().headerName ?? '');
    this.init();
  }

  protected init(): void {
    // переопределяется при необходимости
  }

  abstract onParentModelChanged(model: unknown): void;
}

// ===================== Сумма: «от … до …» =====================

@Component({
  selector: 'app-sum-range-floating',
  imports: [FormsModule, TranslocoPipe, InputText, Popover, SumInputDirective, Icon],
  template: `
    <div class="hs-ff">
      <button
        type="button"
        class="hs-ff-trigger"
        [class.hs-ff-on]="active()"
        [attr.aria-label]="label() + ': ' + ('grid.sumRange' | transloco)"
        aria-haspopup="dialog"
        (click)="pop.toggle($event)"
      >
        <app-icon name="filter" [size]="14" />
        <span class="truncate">{{ text() || ('common.filter' | transloco) }}</span>
      </button>
      @if (active()) {
        <button
          type="button"
          class="hs-ff-clear"
          [attr.aria-label]="'grid.reset' | transloco"
          (click)="reset()"
        >
          <app-icon name="close" [size]="12" />
        </button>
      }
    </div>
    <p-popover #pop appendTo="body">
      <div class="flex w-60 flex-col gap-3 p-1">
        <span class="text-[13px] font-semibold">{{ label() }}</span>
        <div class="grid grid-cols-2 gap-2">
          <label class="flex flex-col gap-1 text-xs text-muted">
            {{ 'grid.from' | transloco }}
            <input
              pInputText
              appSum
              class="hs-ff-input"
              placeholder="0"
              [ngModel]="from()"
              (ngModelChange)="from.set($event); apply()"
            />
          </label>
          <label class="flex flex-col gap-1 text-xs text-muted">
            {{ 'grid.to' | transloco }}
            <input
              pInputText
              appSum
              class="hs-ff-input"
              placeholder="∞"
              [ngModel]="to()"
              (ngModelChange)="to.set($event); apply()"
            />
          </label>
        </div>
        <button
          type="button"
          class="self-end text-[13px] font-medium text-accent disabled:text-faint"
          [disabled]="!active()"
          (click)="reset(); pop.hide()"
        >
          {{ 'grid.reset' | transloco }}
        </button>
      </div>
    </p-popover>
  `,
})
export class SumRangeFloating extends FloatingBase<RangeFilter> {
  protected readonly from = signal<number | null>(null);
  protected readonly to = signal<number | null>(null);
  protected readonly active = computed(() => this.from() !== null || this.to() !== null);
  protected readonly text = computed(() => {
    const f = this.from();
    const t = this.to();
    if (f !== null && t !== null) {
      return `${formatSum(f)} – ${formatSum(t)}`;
    }
    if (f !== null) {
      return `≥ ${formatSum(f)}`;
    }
    return t !== null ? `≤ ${formatSum(t)}` : '';
  });

  onParentModelChanged(model: RangeModel<number> | null): void {
    this.from.set(model?.from ?? null);
    this.to.set(model?.to ?? null);
  }

  protected apply(): void {
    const model = { from: this.from(), to: this.to() };
    this.params.parentFilterInstance((f) => f.apply(model));
  }

  protected reset(): void {
    this.from.set(null);
    this.to.set(null);
    this.params.parentFilterInstance((f) => f.apply(null));
  }
}

// ===================== Дата: период =====================

@Component({
  selector: 'app-date-range-floating',
  imports: [FormsModule, TranslocoPipe, DatePicker],
  template: `
    <p-datepicker
      class="hs-ff hs-ff-date"
      selectionMode="range"
      dateFormat="dd.mm.yy"
      appendTo="body"
      [readonlyInput]="true"
      [showClear]="true"
      [showIcon]="true"
      iconDisplay="input"
      [fluid]="true"
      [defaultDate]="defaultDate"
      [placeholder]="'common.filter' | transloco"
      [ariaLabel]="label() + ': ' + ('grid.dateRange' | transloco)"
      [ngModel]="range()"
      (ngModelChange)="onPick($event)"
      (onClear)="onPick(null)"
    />
  `,
})
export class DateRangeFloating extends FloatingBase<RangeFilter> {
  /** Календарь открывается на «сегодня» приложения (на моках — APP_TODAY). */
  protected readonly defaultDate = isoToLocalDate(inject(APP_TODAY)) ?? undefined;
  protected readonly range = signal<(Date | null)[] | null>(null);

  /** Последняя модель, отправленная отсюда (её «эхо» не должно сбивать выбор периода). */
  private sent: RangeModel<string> | null = null;

  onParentModelChanged(model: RangeModel<string> | null): void {
    if (model?.from === this.sent?.from && model?.to === this.sent?.to) {
      return;
    }
    this.sent = model;
    this.range.set(
      model && (model.from || model.to)
        ? [isoToLocalDate(model.from), isoToLocalDate(model.to ?? model.from)]
        : null,
    );
  }

  /** Выбран один день — фильтр по нему; выбраны оба — по периоду. */
  protected onPick(value: (Date | null)[] | null): void {
    this.range.set(value);
    const from = localDateToIso(value?.[0]);
    const to = localDateToIso(value?.[1]) ?? from;
    const model = from ? { from, to } : null;
    this.sent = model;
    this.params.parentFilterInstance((f) => f.apply(model));
  }
}

// ===================== «Кто оформил»: автодополнение по сотрудникам =====================

@Component({
  selector: 'app-staff-floating',
  imports: [FormsModule, TranslocoPipe, AutoComplete],
  template: `
    <p-autocomplete
      class="hs-ff hs-ff-ac"
      appendTo="body"
      [dropdown]="true"
      [showClear]="true"
      [fluid]="true"
      [suggestions]="suggestions()"
      [placeholder]="'common.filter' | transloco"
      [ariaLabel]="label()"
      [ngModel]="text()"
      (ngModelChange)="onText($event)"
      (completeMethod)="search($event)"
      (onSelect)="onText($event.value)"
      (onClear)="onText('')"
    />
  `,
})
export class StaffFloating extends FloatingBase<unknown> {
  private readonly staff = inject(StaffService);
  protected readonly text = signal('');
  protected readonly suggestions = signal<string[]>([]);
  /** Свой список имён (например, авторы журнала); null — сотрудники из /staff. */
  private readonly ownNames = signal<string[] | null>(null);

  protected override init(): void {
    const source = (this.params as unknown as StaffFilterParams).names;
    if (source) {
      // При ошибке — обычный список сотрудников.
      source().subscribe({
        next: (list) => this.ownNames.set(list),
        error: () => this.staff.load(),
      });
      return;
    }
    // Список сотрудников — GET /staff (доступен любой роли, в отличие от /users).
    this.staff.load();
  }

  onParentModelChanged(model: TextFilterModel | null): void {
    this.text.set(model?.filter ?? '');
  }

  protected search(e: AutoCompleteCompleteEvent): void {
    const q = (e.query ?? '').trim().toLowerCase();
    const names = this.ownNames() ?? this.staff.allNames();
    this.suggestions.set(q ? names.filter((n) => n.toLowerCase().includes(q)) : [...names]);
  }

  protected onText(value: unknown): void {
    const text = typeof value === 'string' ? value : '';
    this.text.set(text);
    const colId = this.params.column.getColId();
    const model: TextFilterModel | null = text.trim()
      ? { filterType: 'text', type: 'contains', filter: text.trim() }
      : null;
    void Promise.resolve(this.params.api.setColumnFilterModel(colId, model)).then(() =>
      this.params.api.onFilterChanged(),
    );
  }
}

// ===================== Подключение к столбцам =====================

/** Столбец суммы: значение — число. */
export function sumFilter<T>(): Partial<ColDef<T>> {
  return {
    filter: RangeFilter,
    filterParams: { mode: 'number' },
    floatingFilterComponent: SumRangeFloating,
  };
}

/** Столбец даты: значение — ISO-строка («YYYY-MM-DD…»). */
export function dateFilter<T>(): Partial<ColDef<T>> {
  return {
    filter: RangeFilter,
    filterParams: { mode: 'date' },
    floatingFilterComponent: DateRangeFloating,
  };
}

/** Источник подсказок для staffFilter (по умолчанию — сотрудники из /staff). */
interface StaffFilterParams {
  names?: () => Observable<string[]>;
}

/**
 * Столбец «Кто оформил» / «Кем добавлен»: текстовый фильтр с подсказками сотрудников.
 * names — свой список подсказок (например, GET /audit-log/authors для журнала).
 */
export function staffFilter<T>(names?: () => Observable<string[]>): Partial<ColDef<T>> {
  return names
    ? { floatingFilterComponent: StaffFloating, floatingFilterComponentParams: { names } }
    : { floatingFilterComponent: StaffFloating };
}
