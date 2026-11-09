import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  ColDef,
  Column,
  GetRowIdFunc,
  IRowNode,
  GridApi,
  GridOptions,
  GridReadyEvent,
  RowClickedEvent,
  RowDoubleClickedEvent,
  RowSelectionOptions,
  SelectionChangedEvent,
} from 'ag-grid-community';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { LanguageService } from '../../core/i18n/language.service';
import { GridEmptyOverlay, GridEmptyParams } from './grid-empty-overlay';
import { GridLoadingOverlay } from './grid-loading-overlay';
import { hotelGridTheme, registerGridModules } from './grid-theme';
import { TablePager } from './table-pager';

registerGridModules();

const SORT_ICON = (char: string) => `<span class="hs-sort-icon" aria-hidden="true">${char}</span>`;

/** Высота строки (grid-theme: rowHeight). */
const ROW_H = 52;
/** Шапка + строка фильтров (headerHeight 42 ×2 + граница). */
const HEAD_H = 85;
/** Сколько строк видно без прокрутки; больше — прокрутка внутри таблицы. */
const MAX_VISIBLE_ROWS = 10;
/** Минимальная высота таблицы (место под «Нет данных» / загрузку). */
const MIN_H = 350;

/** Текст ячейки для окна «Подробнее»: видимый текст рендерера (без aria-hidden). */
function visibleText(node: Node): string {
  const parts: string[] = [];
  const walk = (n: Node) => {
    if (n instanceof Element && n.getAttribute('aria-hidden') === 'true') {
      return;
    }
    if (n.nodeType === Node.TEXT_NODE) {
      const t = n.textContent?.trim();
      if (t) {
        parts.push(t);
      }
      return;
    }
    n.childNodes.forEach(walk);
  };
  walk(node);
  return parts.join(' · ');
}

interface DetailRow {
  label: string;
  value: string;
}

/**
 * Таблица HotelOS на AG Grid: фильтр и сортировка по каждому столбцу,
 * круглый индикатор при загрузке, «Нет данных», пагинация с выбором размера страницы.
 */
@Component({
  selector: 'app-data-grid',
  imports: [AgGridAngular, TablePager, Dialog, ButtonModule, TranslocoPipe],
  template: `
    <!-- Высота — по строкам текущей страницы (до 10); больше 10 — прокрутка внутри,
         шапка с фильтрами и пагинация остаются на месте -->
    <div class="hs-grid hs-grid-body overflow-x-auto overflow-y-hidden" [style.height.px]="gridHeight()">
      <div class="h-full" [style.min-width.px]="minWidth()">
        @for (l of [lang.current()]; track l) {
          <ag-grid-angular
            class="block h-full"
            [theme]="theme"
            [rowData]="rows()"
            [columnDefs]="columns()"
            [defaultColDef]="defaultColDef()"
            [gridOptions]="gridOptions"
            [localeText]="localeText()"
            [loading]="loading()"
            [quickFilterText]="quickFilter()"
            [rowSelection]="rowSelection()"
            [getRowId]="getRowId()"
            [getRowClass]="rowClassFn"
            [pagination]="true"
            [paginationPageSize]="pageSize()"
            [suppressPaginationPanel]="true"
            [paginationPageSizeSelector]="false"
            [overlayComponentSelector]="overlaySelector"
            domLayout="normal"
            (gridReady)="onReady($event)"
            (paginationChanged)="syncPager()"
            (filterChanged)="syncPager()"
            (rowDataUpdated)="syncPager()"
            (modelUpdated)="syncHeight()"
            (firstDataRendered)="syncHeightLater()"
            (selectionChanged)="onSelection($event)"
            (rowClicked)="onRowClick($event)"
            (rowDoubleClicked)="onRowDoubleClick($event)"
          />
        }
      </div>
    </div>
    <app-table-pager
      [page]="page()"
      [pageCount]="pageCount()"
      [total]="total()"
      [(pageSize)]="pageSize"
      (go)="goTo($event)"
    />

    <!-- «Подробнее»: все столбцы строки (двойной клик) -->
    <p-dialog
      [visible]="!!detail()"
      (visibleChange)="!$event && detail.set(null)"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [dismissableMask]="true"
      appendTo="body"
      [header]="'common.details' | transloco"
      [style]="{ width: '560px', maxWidth: 'calc(100vw - 32px)' }"
      styleClass="hs-dialog"
      [closeAriaLabel]="'common.close' | transloco"
    >
      <dl class="m-0 grid grid-cols-[minmax(140px,38%)_1fr] gap-x-4 text-sm">
        @for (r of detail() ?? []; track $index) {
          <dt class="border-b border-line-2 py-2.5 font-medium text-muted">{{ r.label }}</dt>
          <dd class="m-0 border-b border-line-2 py-2.5 break-words whitespace-pre-line text-ink">
            {{ r.value }}
          </dd>
        }
      </dl>
      <ng-template #footer>
        <button pButton type="button" (click)="detail.set(null)">
          <span pButtonLabel>{{ 'common.close' | transloco }}</span>
        </button>
      </ng-template>
    </p-dialog>
  `,
  styles: `
    /* В родителе ограниченной высоты (page-fit) таблица сжимается и прокручивается сама */
    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
      max-height: 100%;
    }
    .hs-grid-body {
      flex: 0 1 auto;
      min-height: 200px;
    }
    :host ::ng-deep .ag-overlay-wrapper {
      padding-top: 84px;
    }

    /* Оверлей не перекрывает строку фильтров: кликабельны только кнопки в нём */
    :host ::ng-deep .ag-overlay-wrapper,
    :host ::ng-deep .ag-overlay-panel {
      pointer-events: none;
    }
    :host ::ng-deep .ag-overlay-panel button,
    :host ::ng-deep .ag-overlay-panel a {
      pointer-events: auto;
    }
    :host ::ng-deep .hs-sort-icon {
      font-size: 13px;
      color: #98a2b3;
    }
    :host ::ng-deep .ag-header-cell-sorted-asc .hs-sort-icon,
    :host ::ng-deep .ag-header-cell-sorted-desc .hs-sort-icon {
      color: var(--color-accent);
    }
    /* Строки кликабельные: выбор — кликом (без чекбоксов), подробности — двойным кликом */
    :host ::ng-deep .ag-row {
      cursor: pointer;
    }
    :host ::ng-deep .ag-cell {
      display: flex;
      align-items: center;
    }
    /* Перенос текста (autoHeight): обычный межстрочный интервал вместо высоты строки */
    :host ::ng-deep .ag-cell-wrap-text {
      line-height: 1.45;
      padding-top: 10px;
      padding-bottom: 10px;
    }
  `,
})
export class DataGrid<T extends object> {
  readonly rows = input.required<T[]>();
  readonly columns = input.required<ColDef<T>[]>();
  readonly loading = input(false);
  readonly selectable = input(false);
  readonly getRowId = input<GetRowIdFunc<T> | undefined>(undefined);
  readonly emptyText = input('common.noDataYet');
  readonly noMatchText = input('common.noMatches');
  readonly minWidth = input(900);
  /** Быстрый поиск по всем столбцам. */
  readonly quickFilter = input('');
  /** Выбранная строка (или null). */
  readonly selection = output<T | null>();
  /** Строки после применения фильтров (для итогов «по фильтру»). */
  readonly filtered = output<T[]>();
  /** Клик по строке (например, открыть запись целиком). */
  readonly rowClick = output<T>();
  /** Двойной клик по строке (полная информация о записи). */
  readonly rowDoubleClick = output<T>();
  /** CSS-класс строки (например, выделить новые записи). */
  readonly rowClass = input<((data: T) => string) | undefined>(undefined);

  protected readonly lang = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);
  private api: GridApi<T> | null = null;

  protected readonly theme = hotelGridTheme;
  protected readonly pageSize = signal(10);
  protected readonly page = signal(0);
  protected readonly pageCount = signal(1);
  protected readonly total = signal(0);
  /** Высота строк текущей страницы (не больше 10 строк). */
  private readonly bodyHeight = signal(0);
  protected readonly gridHeight = computed(() => Math.max(MIN_H, HEAD_H + this.bodyHeight()));
  /** Выключить окно «Подробнее» (у страницы своё окно на двойной клик / клик). */
  readonly details = input(true);
  protected readonly detail = signal<DetailRow[] | null>(null);

  protected readonly defaultColDef = computed<ColDef<T>>(() => ({
    flex: 1,
    minWidth: 90,
    sortable: true,
    unSortIcon: true,
    filter: 'agTextColumnFilter',
    floatingFilter: true,
    suppressFloatingFilterButton: true,
    suppressHeaderMenuButton: true,
    suppressHeaderFilterButton: true,
    suppressMovable: true,
    resizable: false,
    filterParams: { filterOptions: ['contains'], maxNumConditions: 1, debounceMs: 150 },
    floatingFilterComponentParams: { filterPlaceholder: this.placeholder() },
  }));

  private readonly placeholder = computed(() => {
    this.lang.current();
    return this.transloco.translate('common.filter');
  });

  protected readonly gridOptions: GridOptions<T> = {
    animateRows: true,
    suppressCellFocus: true,
    enableCellTextSelection: true,
    ensureDomOrder: true,
    icons: {
      sortAscending: SORT_ICON('↑'),
      sortDescending: SORT_ICON('↓'),
      sortUnSort: SORT_ICON('↕'),
    },
  };

  protected readonly rowSelection = computed<RowSelectionOptions<T> | undefined>(() =>
    this.selectable()
      ? { mode: 'singleRow', checkboxes: false, enableClickSelection: true }
      : undefined,
  );

  /** Подписи AG Grid берутся из словаря grid.* текущего языка. */
  protected readonly localeText = computed(() => {
    this.lang.current();
    return {
      filterOoo: this.transloco.translate('common.filter'),
      loadingOoo: this.transloco.translate('common.loading'),
      noRowsToShow: this.transloco.translate('common.noData'),
      contains: this.transloco.translate('grid.contains'),
      ariaFilterInput: this.transloco.translate('grid.filterInput'),
      ariaFilteringOperator: this.transloco.translate('grid.filterInput'),
      ariaRowSelect: this.transloco.translate('grid.selectRow'),
      ariaRowDeselect: this.transloco.translate('grid.deselectRow'),
      ariaRowToggleSelection: this.transloco.translate('grid.selectRow'),
      ariaColumnFilter: this.transloco.translate('grid.columnFilter'),
      ariaSortableColumn: this.transloco.translate('grid.sortHint'),
      ariaChecked: this.transloco.translate('grid.checked'),
      ariaUnchecked: this.transloco.translate('grid.unchecked'),
      ariaRowSelectionDisabled: this.transloco.translate('grid.selectRow'),
    };
  });

  protected readonly overlaySelector = (params: { overlayType: string }) => {
    if (params.overlayType === 'loading') {
      return { component: GridLoadingOverlay };
    }
    if (params.overlayType === 'noRows' || params.overlayType === 'noMatchingRows') {
      const p: GridEmptyParams = { emptyText: this.emptyText(), noMatchText: this.noMatchText() };
      return { component: GridEmptyOverlay, params: p };
    }
    return undefined;
  };

  constructor() {
    // При смене размера страницы — на первую страницу.
    effect(() => {
      this.pageSize();
      this.api?.paginationGoToFirstPage();
    });
  }

  protected onReady(event: GridReadyEvent<T>): void {
    this.api = event.api;
    this.syncPager();
  }

  protected syncPager(): void {
    const api = this.api;
    if (!api || api.isDestroyed()) {
      return;
    }
    this.total.set(api.getDisplayedRowCount());
    const rows: T[] = [];
    api.forEachNodeAfterFilter((n) => n.data && rows.push(n.data));
    this.filtered.emit(rows);
    this.pageCount.set(Math.max(1, api.paginationGetTotalPages()));
    this.page.set(api.paginationGetCurrentPage());
    this.syncHeight();
  }

  /**
   * Высота таблицы = сумма высот строк текущей страницы, но не больше 10 строк.
   * Многостраничная таблица держит высоту полной страницы, чтобы пагинация не «прыгала».
   */
  protected syncHeight(): void {
    const api = this.api;
    if (!api || api.isDestroyed()) {
      return;
    }
    const size = api.paginationGetPageSize();
    const start = api.paginationGetCurrentPage() * size;
    const onPage = Math.max(0, Math.min(size, api.getDisplayedRowCount() - start));
    let h = 0;
    for (let i = 0; i < Math.min(onPage, MAX_VISIBLE_ROWS); i++) {
      h += api.getDisplayedRowAtIndex(start + i)?.rowHeight ?? ROW_H;
    }
    if (api.paginationGetTotalPages() > 1) {
      h = Math.max(h, Math.min(size, MAX_VISIBLE_ROWS) * ROW_H);
    }
    this.bodyHeight.set(h);
  }

  /** Строки с autoHeight получают высоту после отрисовки — пересчитать ещё раз. */
  protected syncHeightLater(): void {
    requestAnimationFrame(() => requestAnimationFrame(() => this.syncHeight()));
  }

  protected goTo(page: number): void {
    this.api?.paginationGoToPage(page);
  }

  protected readonly rowClassFn = (p: { data?: T }) => {
    const fn = this.rowClass();
    return fn && p.data ? fn(p.data) : '';
  };

  protected onRowClick(event: RowClickedEvent<T>): void {
    if (event.data) {
      this.rowClick.emit(event.data);
    }
  }

  protected onRowDoubleClick(event: RowDoubleClickedEvent<T>): void {
    if (event.data) {
      this.rowDoubleClick.emit(event.data);
      if (this.details()) {
        // двойной клик выделяет слово в ячейке — снять выделение
        window.getSelection()?.removeAllRanges();
        this.detail.set(this.detailRows(event.node));
      }
    }
  }

  /** Подпись столбца → значение, как в таблице (форматтер или текст рендерера). */
  private detailRows(node: IRowNode<T>): DetailRow[] {
    const api = this.api;
    if (!api) {
      return [];
    }
    return api
      .getAllDisplayedColumns()
      .filter((col: Column) => !!col.getColDef().headerName)
      .map((col: Column) => {
        const def = col.getColDef();
        const raw = api.getCellValue({ rowNode: node, colKey: col.getColId() });
        let text: unknown = api.getCellValue({
          rowNode: node,
          colKey: col.getColId(),
          useFormatter: true,
        });
        const renderer = def.cellRenderer;
        if (typeof renderer === 'function') {
          try {
            const out: unknown = (renderer as (p: unknown) => unknown)({
              value: raw,
              data: node.data,
              node,
              colDef: def,
              column: col,
              api,
            });
            const t =
              out instanceof Node
                ? visibleText(out)
                : typeof out === 'string'
                  ? visibleText(new DOMParser().parseFromString(out, 'text/html').body)
                  : '';
            if (t) {
              text = t;
            }
          } catch {
            // рендерер-компонент — остаётся значение столбца
          }
        }
        const value = text === null || text === undefined || text === '' ? '—' : String(text);
        return { label: def.headerName ?? '', value };
      });
  }

  protected onSelection(event: SelectionChangedEvent<T>): void {
    this.selection.emit(event.api.getSelectedRows()[0] ?? null);
  }

  /** Снять выделение (после удаления записи). */
  clearSelection(): void {
    this.api?.deselectAll();
  }

  /** Сбросить все фильтры столбцов. */
  resetFilters(): void {
    this.api?.setFilterModel(null);
  }
}
