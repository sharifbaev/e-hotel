import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  booleanAttribute,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import {
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ColDef } from 'ag-grid-community';
import { ButtonModule } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { Observable } from 'rxjs';
import { APP_TODAY, ApiError } from '../../core/api/mock-api';
import { DebtsService } from '../../core/data/debts.service';
import { ExpensesService } from '../../core/data/expenses.service';
import { ExtraServicesService } from '../../core/data/extra-services.service';
import { LanguageService } from '../../core/i18n/language.service';
import { BreakpointService } from '../../core/layout/breakpoint.service';
import { StaffService } from '../../core/data/staff.service';
import { Expense, ExpenseDraft, LedgerKind, SERVICE_TYPES, ServiceType } from '../../core/models';
import { NotifyService } from '../../core/notify/notify.service';
import {
  formatDateTime,
  formatSum,
  isoToLocalDate,
  localDateTimeSecToIso,
  localDateToIso,
} from '../../shared/format/format';
import { DayMonthPipe, DmyPipe, PluralPipe, SumPipe } from '../../shared/format/format.pipes';
import { SumInputDirective } from '../../shared/forms/sum-input.directive';
import { avatarCell } from '../../shared/grid/cells';
import { DataGrid } from '../../shared/grid/data-grid';
import { dateFilter, staffFilter, sumFilter } from '../../shared/grid/grid-filters';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog/confirm-dialog';
import { Icon, IconName } from '../../shared/ui/icon/icon';
import { Sheet } from '../../shared/ui/sheet/sheet';

/** Префикс i18n и оформление для каждой вкладки «Платежи и расходы». */
const KIND_CFG: Record<
  LedgerKind,
  { i18n: string; icon: IconName; sumClass: string; iconClass: string; sign: string }
> = {
  expense: {
    i18n: 'expenses',
    icon: 'wallet',
    sumClass: 'text-danger',
    iconClass: 'bg-[#FEECEB] text-danger',
    sign: '−',
  },
  service: {
    i18n: 'services',
    icon: 'star',
    sumClass: 'text-success',
    iconClass: 'bg-accent-soft text-success',
    sign: '+',
  },
  debt: {
    i18n: 'debts',
    icon: 'receipt',
    sumClass: 'text-[#B54708]',
    iconClass: 'bg-[#FEF0C7] text-[#B54708]',
    sign: '',
  },
};

@Component({
  selector: 'app-expenses',
  imports: [
    NgTemplateOutlet,
    FormsModule,
    ReactiveFormsModule,
    TranslocoPipe,
    ButtonModule,
    DatePicker,
    Dialog,
    InputText,
    Select,
    Textarea,
    DataGrid,
    ConfirmDialog,
    Icon,
    Sheet,
    SumInputDirective,
    SumPipe,
    DmyPipe,
    DayMonthPipe,
    PluralPipe,
  ],
  templateUrl: './expenses.html',
})
export class ExpensesPage {
  /** Какая таблица: расходы (по умолчанию), дополнительные сервисы или долги. */
  readonly kind = input<LedgerKind>('expense');
  /** Внутри вкладок «Платежи и расходы»: без собственного заголовка страницы. */
  readonly embedded = input(false, { transform: booleanAttribute });

  private readonly apis = {
    expense: inject(ExpensesService),
    service: inject(ExtraServicesService),
    debt: inject(DebtsService),
  };
  private get api() {
    return this.apis[this.kind()];
  }
  protected readonly cfg = computed(() => KIND_CFG[this.kind()]);
  /** Префикс ключей i18n: expenses / services / debts. */
  protected readonly p = computed(() => this.cfg().i18n);
  protected readonly serviceTypes = SERVICE_TYPES;

  private readonly notify = inject(NotifyService);
  private readonly transloco = inject(TranslocoService);
  private readonly lang = inject(LanguageService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly today = inject(APP_TODAY);
  protected readonly bp = inject(BreakpointService);

  private readonly grid = viewChild<DataGrid<Expense>>(DataGrid);

  private readonly res = rxResource({
    params: () => this.kind(),
    stream: ({ params }) => this.apis[params].list(),
  });
  protected readonly items = linkedSignal<Expense[]>(() =>
    this.res.hasValue() ? this.res.value() : [],
  );
  protected readonly loading = computed(() => this.res.isLoading());
  private readonly staffApi = inject(StaffService);
  /** «Кто оформил»: сотрудники из GET /staff. */
  protected readonly staff = this.staffApi.names;

  constructor() {
    this.staffApi.load();
  }

  protected readonly selected = signal<Expense | null>(null);
  protected readonly saving = signal(false);

  // ----- Форма -----
  protected readonly formOpen = signal(false);
  protected readonly editId = signal<number | null>(null);
  protected readonly tried = signal(false);
  protected readonly form = this.fb.group({
    // Обязательность причины / вида услуги / ФИО зависит от вкладки — см. missing().
    reason: [''],
    serviceType: this.fb.control<ServiceType | null>(null),
    debtor: [''],
    sum: this.fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
    date: this.fb.control<Date | null>(null, Validators.required),
    who: [''],
  });

  private readonly serviceType = toSignal(this.form.controls.serviceType.valueChanges, {
    initialValue: null,
  });
  /** Поле «Причина» в форме: всегда, кроме сервисов с видом из списка. */
  protected readonly showReason = computed(
    () => this.kind() !== 'service' || this.serviceType() === 'other',
  );

  // ----- Удаление -----
  protected readonly confirmOpen = signal(false);

  // ===== Десктоп =====
  /** Строки таблицы после фильтров по столбцам. */
  protected readonly filteredRows = signal<Expense[] | null>(null);

  protected readonly stats = computed(() => {
    const list = this.filteredRows() ?? this.items();
    const total = list.reduce((s, e) => s + e.sum, 0);
    const biggest = list.reduce<Expense | null>((m, e) => (!m || e.sum > m.sum ? e : m), null);
    return { total, count: list.length, biggest: biggest ? this.titleOf(biggest) : '—' };
  });

  protected readonly columns = computed<ColDef<Expense>[]>(() => {
    this.lang.current();
    const t = (k: string) => this.transloco.translate(`${this.p()}.${k}`);
    const kind = this.kind();
    const cols: ColDef<Expense>[] = [
      {
        field: 'reason',
        headerName: t('col.reason'),
        flex: 2.4,
        minWidth: 240,
        cellClass: kind === 'debt' ? 'text-ink-2' : 'font-medium',
        ...(kind === 'service'
          ? { valueGetter: (p) => (p.data ? this.reasonOf(p.data) : '') }
          : {}),
      },
      {
        field: 'sum',
        headerName: t('col.sum'),
        flex: 1.1,
        type: 'rightAligned',
        valueFormatter: (p) => formatSum(p.value),
        ...sumFilter<Expense>(),
        cellClass: `font-semibold tabular-nums ${this.cfg().sumClass}`,
      },
      {
        field: 'date',
        headerName: t('col.date'),
        flex: 1,
        sort: 'desc',
        minWidth: 170,
        valueFormatter: (p) => formatDateTime(p.value),
        ...dateFilter<Expense>(),
        cellClass: 'text-ink-2',
      },
      {
        field: 'who',
        headerName: t('col.who'),
        flex: 1.6,
        cellRenderer: (p: { value: string }) => avatarCell(p.value, { size: 28 }),
        ...staffFilter<Expense>(),
      },
    ];
    if (kind === 'debt') {
      cols.unshift({
        field: 'debtor',
        headerName: t('col.debtor'),
        flex: 1.8,
        minWidth: 200,
        cellClass: 'font-medium',
      });
    }
    return cols;
  });

  /** Причина для показа: у сервисов из списка — название вида услуги. */
  protected reasonOf(e: Expense): string {
    this.lang.current();
    return e.serviceType && e.serviceType !== 'other'
      ? this.transloco.translate(`serviceTypes.${e.serviceType}`)
      : e.reason;
  }

  /** Главная подпись записи: у долгов — ФИО должника, иначе причина. */
  protected titleOf(e: Expense): string {
    return this.kind() === 'debt' ? (e.debtor ?? '') : this.reasonOf(e);
  }

  protected readonly rowId = (p: { data: Expense }) => String(p.data.id);

  // ===== Мобильная версия =====
  protected readonly mDate = signal<Date | null>(null);
  protected readonly mWho = signal<string | null>(null);
  protected readonly actionOpen = signal(false);
  protected readonly confirmInline = signal(false);

  protected readonly mobileList = computed(() => {
    const day = localDateToIso(this.mDate());
    const who = this.mWho();
    return this.items()
      .filter((e) => (!day || e.date.slice(0, 10) === day) && (!who || e.who === who))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  });

  protected readonly mobileGroups = computed(() => {
    const groups = new Map<string, Expense[]>();
    for (const e of this.mobileList()) {
      // Группы по дню (в date — дата и время).
      const day = e.date.slice(0, 10);
      groups.set(day, [...(groups.get(day) ?? []), e]);
    }
    return [...groups.entries()].map(([date, items]) => ({
      date,
      items,
      total: items.reduce((s, e) => s + e.sum, 0),
    }));
  });

  protected readonly mobileTotal = computed(() => this.mobileList().reduce((s, e) => s + e.sum, 0));

  protected select(e: Expense | null): void {
    this.selected.set(e);
  }

  protected reload(): void {
    this.selected.set(null);
    this.res.reload();
  }

  protected openAdd(): void {
    this.editId.set(null);
    this.tried.set(false);
    this.form.reset({
      reason: '',
      serviceType: null,
      debtor: '',
      sum: null,
      date: this.nowOnToday(),
      who: this.staffApi.myName() || this.staff()[0] || '',
    });
    this.actionOpen.set(false);
    this.formOpen.set(true);
  }

  protected openEdit(): void {
    const e = this.selected();
    if (!e) {
      return;
    }
    this.editId.set(e.id);
    this.tried.set(false);
    this.form.reset({
      reason: e.reason,
      serviceType: e.serviceType ?? null,
      debtor: e.debtor ?? '',
      sum: e.sum,
      date: isoToLocalDate(e.date),
      who: e.who,
    });
    this.actionOpen.set(false);
    this.formOpen.set(true);
  }

  /** «Сегодня» (APP_TODAY) с текущим временем — по умолчанию для новой записи. */
  private nowOnToday(): Date {
    const d = isoToLocalDate(this.today) ?? new Date();
    const now = new Date();
    d.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
    return d;
  }

  protected invalid(name: 'reason' | 'serviceType' | 'debtor' | 'sum' | 'date'): boolean {
    if (!this.tried()) {
      return false;
    }
    return name === 'sum' || name === 'date'
      ? this.form.controls[name].invalid
      : this.missing(name);
  }

  /** Не заполнено поле, обязательное на текущей вкладке. */
  private missing(name: 'reason' | 'serviceType' | 'debtor'): boolean {
    const v = this.form.getRawValue();
    switch (name) {
      case 'reason':
        return this.showReason() && !v.reason.trim();
      case 'serviceType':
        return this.kind() === 'service' && !v.serviceType;
      case 'debtor':
        return this.kind() === 'debt' && !v.debtor.trim();
    }
  }

  protected save(): void {
    this.tried.set(true);
    if (
      this.form.invalid ||
      this.missing('reason') ||
      this.missing('serviceType') ||
      this.missing('debtor')
    ) {
      this.notify.error('common.saveError', `${this.p()}.toast.required`);
      return;
    }
    const v = this.form.getRawValue();
    const kind = this.kind();
    const draft: ExpenseDraft = {
      reason: this.showReason() ? v.reason.trim() : '',
      sum: v.sum ?? 0,
      date: localDateTimeSecToIso(v.date) ?? this.today,
      who: v.who,
      ...(kind === 'service' && v.serviceType ? { serviceType: v.serviceType } : {}),
      ...(kind === 'debt' ? { debtor: v.debtor.trim() } : {}),
    };
    const id = this.editId();
    const req: Observable<Expense> =
      id === null ? this.api.create(draft) : this.api.update(id, draft);
    this.saving.set(true);
    req.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.formOpen.set(false);
        if (id === null) {
          this.items.update((list) => [saved, ...list]);
          this.notify.success(`${this.p()}.toast.addedTitle`, `${this.p()}.toast.addedText`, {
            sum: formatSum(saved.sum),
            reason: this.titleOf(saved),
          });
        } else {
          this.items.update((list) => list.map((e) => (e.id === id ? saved : e)));
          this.notify.success('common.savedTitle', `${this.p()}.toast.updatedText`, {
            reason: this.titleOf(saved),
          });
        }
        this.selected.set(saved);
      },
      error: (e: unknown) => {
        this.saving.set(false);
        this.notify.error(
          'common.saveError',
          e instanceof ApiError ? `errors.${e.code}` : 'errors.common.unknown',
        );
      },
    });
  }

  protected askDelete(): void {
    if (this.selected()) {
      this.confirmOpen.set(true);
    }
  }

  protected doDelete(): void {
    const e = this.selected();
    if (!e) {
      return;
    }
    this.saving.set(true);
    this.api.remove(e.id).subscribe({
      error: (err: unknown) => {
        this.saving.set(false);
        this.notify.error(
          'common.saveError',
          err instanceof ApiError ? `errors.${err.code}` : 'errors.common.unknown',
        );
      },
      next: () => {
        this.saving.set(false);
        this.confirmOpen.set(false);
        this.actionOpen.set(false);
        this.confirmInline.set(false);
        this.items.update((list) => list.filter((x) => x.id !== e.id));
        this.selected.set(null);
        this.grid()?.clearSelection();
        this.notify.success(`${this.p()}.toast.deletedTitle`, `${this.p()}.toast.deletedText`, {
          reason: this.titleOf(e),
        });
      },
    });
  }

  // ----- Мобильные действия -----
  protected openActions(e: Expense): void {
    this.selected.set(e);
    this.confirmInline.set(false);
    this.actionOpen.set(true);
  }
}
