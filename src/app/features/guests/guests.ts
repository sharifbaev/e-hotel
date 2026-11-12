import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ColDef } from 'ag-grid-community';
import { ButtonModule } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { BlacklistService } from '../../core/data/blacklist.service';
import { GuestsService } from '../../core/data/guests.service';
import { LanguageService } from '../../core/i18n/language.service';
import { PaymentTypesService } from '../../core/data/payment-types.service';
import { NotifyService } from '../../core/notify/notify.service';
import { BreakpointService } from '../../core/layout/breakpoint.service';
import { MOCK_COUNTRIES } from '../../core/mocks/mock-data';
import { FiscalReceiptData } from '../../core/docs/fiscal-receipt-doc';
import { ArchivedGuest, MIXED_PAYMENT } from '../../core/models';
import { formatDateTime, formatDmy, formatSum, initials } from '../../shared/format/format';
import { DmyPipe, SumPipe } from '../../shared/format/format.pipes';
import { avatarCell } from '../../shared/grid/cells';
import { DataGrid } from '../../shared/grid/data-grid';
import { dateFilter, sumFilter } from '../../shared/grid/grid-filters';
import { GuestInfo, GuestInfoDialog } from '../../shared/ui/guest-info/guest-info-dialog';
import { FiscalReceiptDialog } from '../../shared/ui/fiscal-receipt/fiscal-receipt-dialog';
import { Icon } from '../../shared/ui/icon/icon';
import { Sheet } from '../../shared/ui/sheet/sheet';
import { BlacklistDialog, BlacklistPerson } from '../blacklist/blacklist-dialog';

type MobileSort = 'out-desc' | 'out-asc' | 'name-asc' | 'sum-desc';

interface MobileFilters {
  sort: MobileSort;
  country: string | null;
  room: string;
  month: string | null;
}

const EMPTY_FILTERS: MobileFilters = { sort: 'out-desc', country: null, room: '', month: null };
const MOBILE_PAGE = 6;

@Component({
  selector: 'app-guests',
  imports: [
    FormsModule,
    TranslocoPipe,
    ButtonModule,
    InputText,
    Select,
    Icon,
    Sheet,
    DataGrid,
    BlacklistDialog,
    GuestInfoDialog,
    FiscalReceiptDialog,
    SumPipe,
    DmyPipe,
  ],
  templateUrl: './guests.html',
})
export class GuestsPage {
  private readonly guestsApi = inject(GuestsService);
  private readonly transloco = inject(TranslocoService);
  private readonly lang = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly blacklist = inject(BlacklistService);
  private readonly notify = inject(NotifyService);
  private readonly payTypes = inject(PaymentTypesService);
  protected readonly bp = inject(BreakpointService);

  /** Query-параметр ?q= — поиск из шапки. */
  readonly q = input<string | undefined>();

  private readonly archiveRes = rxResource({ stream: () => this.guestsApi.archive() });
  protected readonly rows = computed(() =>
    this.archiveRes.hasValue() ? this.archiveRes.value() : [],
  );
  protected readonly loading = computed(() => this.archiveRes.isLoading());

  protected readonly search = signal('');

  constructor() {
    this.payTypes.ensureLoaded();
    effect(() => this.search.set(this.q() ?? ''));
  }

  protected reload(): void {
    this.archiveRes.reload();
  }

  /** Новые гости добавляются в «Книгу» (архив пополняется после выезда). */
  protected openReg(): void {
    this.router.navigate(['/book'], { queryParams: { register: 1 } });
  }

  // ===== Чёрный список =====
  /** Меняется после добавления в ЧС — пересчитать отметки. */
  private readonly bannedTick = signal(0);
  protected readonly selected = signal<ArchivedGuest | null>(null);
  protected readonly blOpen = signal(false);
  protected readonly blPerson = signal<BlacklistPerson | null>(null);

  protected isBanned(g: ArchivedGuest): boolean {
    this.bannedTick();
    return this.blacklist.find(g.doc) !== null;
  }

  protected openBlacklist(g: ArchivedGuest | null = this.selected()): void {
    if (!g) {
      return;
    }
    if (this.blacklist.find(g.doc)) {
      this.notifyExists(g.doc);
      return;
    }
    this.blPerson.set({
      doc: g.doc,
      lastName: g.lastName,
      firstName: g.firstName,
      middleName: g.middleName,
      country: g.country,
    });
    this.blOpen.set(true);
  }

  protected onBlacklisted(): void {
    this.bannedTick.update((n) => n + 1);
  }

  // ===== Фискальный чек (просмотр в модалке и печать) =====
  protected readonly receiptOpen = signal(false);
  protected readonly receipt = signal<FiscalReceiptData | null>(null);

  protected openReceipt(g: ArchivedGuest | null = this.selected()): void {
    if (!g?.receipt) {
      return;
    }
    this.receipt.set(g.receipt);
    this.receiptOpen.set(true);
  }

  /** Из карточки гостя — закрыть её и открыть чек. */
  protected receiptFromInfo(): void {
    const g = this.infoGuest();
    this.infoOpen.set(false);
    this.openReceipt(g);
  }

  // ===== Полная информация (двойной клик по строке / нажатие на карточку) =====
  protected readonly infoOpen = signal(false);
  protected readonly infoGuest = signal<ArchivedGuest | null>(null);
  protected readonly info = computed<GuestInfo | null>(() => {
    this.bannedTick();
    const g = this.infoGuest();
    if (!g) {
      return null;
    }
    const banned = this.blacklist.find(g.doc);
    const t = (k: string) => this.transloco.translate(k);
    return {
      name: `${g.lastName} ${g.firstName} ${g.middleName}`.trim(),
      sub: `${g.doc} · ${t('guests.col.room')} ${g.room}`,
      banned: banned !== null,
      bannedReason: banned?.reason,
      sections: [
        {
          title: 'guests.reg.personal',
          items: [
            { label: 'guests.reg.docNumber', value: g.doc },
            { label: 'guests.reg.country', value: 'countries.' + g.country, translate: true },
            { label: 'guests.reg.birthDate', value: formatDmy(g.birthDate) },
            { label: 'guests.reg.sex', value: 'sex.' + g.sex, translate: true },
            { label: 'guests.reg.phone', value: g.phone },
          ],
        },
        {
          title: 'guests.reg.stay',
          items: [
            { label: 'guests.reg.room', value: g.room },
            { label: 'guestInfo.nights', value: String(nights(g.checkin, g.checkout)) },
            { label: 'guests.reg.checkin', value: formatDmy(g.checkin) },
            { label: 'guests.reg.checkout', value: formatDmy(g.checkout) },
            { label: 'guests.reg.amount', value: `${formatSum(g.sum)} ${t('common.currency')}` },
            ...(g.checkoutPayment
              ? [{ label: 'rooms.checkoutPayment', value: this.payTypes.label(g.checkoutPayment) }]
              : []),
            ...(g.checkoutPayment === MIXED_PAYMENT
              ? [
                  {
                    label: 'rooms.paidCard',
                    value: `${formatSum(g.paidCard ?? 0)} ${t('common.currency')}`,
                  },
                  {
                    label: 'rooms.paidCash',
                    value: `${formatSum(g.paidCash ?? 0)} ${t('common.currency')}`,
                  },
                ]
              : []),
          ],
        },
      ],
    };
  });

  /** Кнопка «В чёрный список» в карточке — если гость ещё не в списке. */
  protected readonly infoCanBan = computed(() => {
    this.bannedTick();
    const g = this.infoGuest();
    return g !== null && this.blacklist.find(g.doc) === null;
  });

  protected banFromInfo(): void {
    const g = this.infoGuest();
    this.infoOpen.set(false);
    this.openBlacklist(g);
  }

  protected openInfo(g: ArchivedGuest): void {
    this.infoGuest.set(g);
    this.infoOpen.set(true);
  }

  private notifyExists(doc: string): void {
    this.notify.error('blacklist.toast.existsTitle', 'blacklist.toast.existsText', { doc });
  }

  // ===== Десктоп: AG Grid =====
  protected readonly columns = computed<ColDef<ArchivedGuest>[]>(() => {
    this.lang.current();
    this.bannedTick();
    const t = (k: string) => this.transloco.translate(k);
    const fullName = (g: ArchivedGuest) => `${g.lastName} ${g.firstName}`.trim();
    return [
      {
        colId: 'name',
        headerName: t('guests.col.name'),
        flex: 2,
        minWidth: 220,
        valueGetter: (p) => (p.data ? fullName(p.data) : ''),
        cellRenderer: (p: { value: string; data?: ArchivedGuest }) =>
          p.data && this.blacklist.find(p.data.doc)
            ? avatarCell(p.value, { bg: '#FEE4E2', fg: '#B42318', sub: t('book.banned') })
            : avatarCell(p.value),
      },
      {
        field: 'doc',
        headerName: t('guests.col.doc'),
        flex: 1.2,
        cellClass: 'tabular-nums text-ink-2',
      },
      {
        colId: 'country',
        headerName: t('guests.col.country'),
        flex: 1.2,
        valueGetter: (p) => (p.data ? t('countries.' + p.data.country) : ''),
        cellClass: 'text-ink-2',
      },
      {
        field: 'room',
        headerName: t('guests.col.room'),
        flex: 0.7,
        minWidth: 90,
        cellClass: 'text-ink-2',
      },
      {
        field: 'checkin',
        headerName: t('guests.col.checkin'),
        flex: 1,
        minWidth: 170,
        valueFormatter: (p) => formatDateTime(p.value),
        ...dateFilter<ArchivedGuest>(),
        cellClass: 'text-ink-2',
      },
      {
        field: 'checkout',
        headerName: t('guests.col.checkout'),
        flex: 1,
        sort: 'desc',
        minWidth: 170,
        valueFormatter: (p) => formatDateTime(p.value),
        ...dateFilter<ArchivedGuest>(),
        cellClass: 'text-ink-2',
      },
      {
        field: 'sum',
        headerName: t('guests.col.sum'),
        flex: 1.1,
        valueFormatter: (p) => formatSum(p.value),
        ...sumFilter<ArchivedGuest>(),
        cellClass: 'font-semibold tabular-nums',
      },
      {
        colId: 'payment',
        headerName: t('rooms.checkoutPayment'),
        flex: 1.2,
        minWidth: 190,
        valueGetter: (p) => {
          const g = p.data;
          if (!g?.checkoutPayment) {
            return '';
          }
          return g.checkoutPayment === MIXED_PAYMENT
            ? t('paymentShort.mixed')
            : this.payTypes.label(g.checkoutPayment);
        },
        // «Смешанный» — разбивка второй строкой; всё обрезается внутри ячейки, полный текст — в подсказке
        cellRenderer: (p: { value: string; data?: ArchivedGuest }) => {
          const g = p.data;
          if (!p.value) {
            return '—';
          }
          const esc = (v: string) =>
            v.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
          if (g?.checkoutPayment !== MIXED_PAYMENT) {
            return `<span class="block truncate">${esc(p.value)}</span>`;
          }
          const split = `${t('paymentShort.card')} ${formatSum(g.paidCard ?? 0)} · ${t('paymentShort.cash')} ${formatSum(g.paidCash ?? 0)}`;
          return `<span class="flex min-w-0 flex-col leading-tight"><span class="truncate">${esc(p.value)}</span><span class="truncate text-xs text-muted tabular-nums">${esc(split)}</span></span>`;
        },
        tooltipValueGetter: (p) => {
          const g = p.data;
          if (!g?.checkoutPayment) {
            return null;
          }
          const name = this.payTypes.label(g.checkoutPayment);
          return g.checkoutPayment === MIXED_PAYMENT
            ? `${name}: ${t('rooms.paidCard')} ${formatSum(g.paidCard ?? 0)}, ${t('rooms.paidCash')} ${formatSum(g.paidCash ?? 0)}`
            : name;
        },
        cellClass: 'text-ink-2 overflow-hidden',
      },
      {
        colId: 'receipt',
        headerName: t('guests.col.receipt'),
        flex: 0.9,
        minWidth: 110,
        valueGetter: (p) => p.data?.receipt?.number ?? '',
        valueFormatter: (p) => p.value || '—',
        cellClass: 'tabular-nums text-ink-2',
      },
    ];
  });

  protected readonly rowId = (p: { data: ArchivedGuest }) => String(p.data.id);

  // ===== Мобильная версия: карточки + фильтры в шторке =====
  protected readonly filtersOpen = signal(false);
  protected readonly filters = signal<MobileFilters>(EMPTY_FILTERS);
  protected readonly draft = signal<MobileFilters>(EMPTY_FILTERS);
  protected readonly shown = signal(MOBILE_PAGE);
  protected readonly loadingMore = signal(false);
  protected readonly countries = MOCK_COUNTRIES;
  protected readonly sorts: MobileSort[] = ['out-desc', 'out-asc', 'name-asc', 'sum-desc'];
  protected readonly months = ['09', '10'];

  protected readonly mobileRows = computed(() => {
    this.lang.current();
    const q = this.search().trim().toLowerCase();
    const f = this.filters();
    const list = this.rows().filter((g) => {
      const name = `${g.lastName} ${g.firstName}`.toLowerCase();
      return (
        (!q || name.includes(q) || g.doc.toLowerCase().includes(q)) &&
        (!f.country || g.country === f.country) &&
        (!f.room || g.room.includes(f.room.trim())) &&
        (!f.month || g.checkout.slice(5, 7) === f.month)
      );
    });
    const sorted = [...list].sort((a, b) => {
      switch (f.sort) {
        case 'out-asc':
          return a.checkout.localeCompare(b.checkout);
        case 'name-asc':
          return a.lastName.localeCompare(b.lastName, 'ru');
        case 'sum-desc':
          return b.sum - a.sum;
        default:
          return b.checkout.localeCompare(a.checkout);
      }
    });
    return sorted;
  });

  protected readonly visibleMobile = computed(() => this.mobileRows().slice(0, this.shown()));
  protected readonly canMore = computed(() => this.shown() < this.mobileRows().length);

  protected readonly activeChips = computed(() => {
    const f = this.filters();
    const chips: { key: keyof MobileFilters; label: string; params?: Record<string, unknown> }[] =
      [];
    if (f.country) {
      chips.push({ key: 'country', label: 'countries.' + f.country });
    }
    if (f.room) {
      chips.push({ key: 'room', label: 'guests.mobile.chipRoom', params: { room: f.room } });
    }
    if (f.month) {
      chips.push({ key: 'month', label: 'months.full.' + Number(f.month) });
    }
    return chips;
  });

  protected initials(g: ArchivedGuest): string {
    return initials(`${g.lastName} ${g.firstName}`);
  }

  protected openFilters(): void {
    this.draft.set(this.filters());
    this.filtersOpen.set(true);
  }

  protected patchDraft(patch: Partial<MobileFilters>): void {
    this.draft.update((d) => ({ ...d, ...patch }));
  }

  protected applyFilters(): void {
    this.filters.set(this.draft());
    this.shown.set(MOBILE_PAGE);
    this.filtersOpen.set(false);
  }

  protected removeChip(key: keyof MobileFilters): void {
    this.filters.update((f) => ({ ...f, [key]: EMPTY_FILTERS[key] }));
  }

  protected resetAll(): void {
    this.filters.set(EMPTY_FILTERS);
    this.search.set('');
  }

  protected more(): void {
    this.loadingMore.set(true);
    setTimeout(() => {
      this.shown.update((n) => n + MOBILE_PAGE);
      this.loadingMore.set(false);
    }, 600);
  }
}

/** Ночей между датами заезда и выезда (ISO YYYY-MM-DD), минимум 1. */
function nights(from: string, to: string): number {
  const d = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  return Math.max(1, Math.round((d(to) - d(from)) / 86_400_000));
}
