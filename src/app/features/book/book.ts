import { ApiError } from '../../core/api/mock-api';
import { Component, computed, effect, inject, input, linkedSignal, signal, viewChild } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RoomsService } from '../../core/data/rooms.service';
import { CheckoutDialog } from '../rooms/checkout-dialog';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ColDef } from 'ag-grid-community';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { BlacklistService } from '../../core/data/blacklist.service';
import { BookService } from '../../core/data/book.service';
import { LanguageService } from '../../core/i18n/language.service';
import { PaymentTypesService } from '../../core/data/payment-types.service';
import { PayLabelPipe } from '../../shared/format/pay-label.pipe';
import { BreakpointService } from '../../core/layout/breakpoint.service';
import { NotifyService } from '../../core/notify/notify.service';
import { BookEntry, GuestRegistration, PaymentMethod } from '../../core/models';
import { formatDateTime, formatDmy, formatSum, formatTime, initials } from '../../shared/format/format';
import { DayMonthPipe, SumPipe } from '../../shared/format/format.pipes';
import { avatarCell, pillCell } from '../../shared/grid/cells';
import { DataGrid } from '../../shared/grid/data-grid';
import { dateFilter, sumFilter } from '../../shared/grid/grid-filters';
import { GuestInfo, GuestInfoDialog } from '../../shared/ui/guest-info/guest-info-dialog';
import { Icon } from '../../shared/ui/icon/icon';
import { Sheet } from '../../shared/ui/sheet/sheet';
import { BlacklistDialog, BlacklistPerson } from '../blacklist/blacklist-dialog';
import { RegistrationForm } from '../guests/registration-form/registration-form';
import { RegistrationTabs } from '../guests/registration-form/registration-tabs';

type PayFilter = PaymentMethod | 'all';

/** Строка книги + отметка «в чёрном списке». */
export interface BookRow extends BookEntry {
  banned: boolean;
}

type Tone = { bg: string; fg: string; dot: string };

/** Цвета способов оплаты (контраст текста ≥ 4.5:1 на подложке). */
export const PAYMENT_TONE: Record<string, Tone> = {
  cash: { bg: '#E7F6EC', fg: '#166534', dot: '#2E8B57' },
  uzcard: { bg: '#DCE7FD', fg: '#1E3A8A', dot: '#3B6FE0' },
  visa: { bg: '#EDE9FE', fg: '#5B21B6', dot: '#7C5CDB' },
  transfer: { bg: '#F2F4F7', fg: '#344054', dot: '#98A2B3' },
  mixed: { bg: '#E0F2FE', fg: '#075985', dot: '#0EA5E9' },
  unpaid: { bg: '#FDEBD3', fg: '#7A3A0A', dot: '#E8A54B' },
};

/** Свои типы оплаты из справочника — нейтральный цвет. */
const CUSTOM_TONE: Tone = { bg: '#E0F2F1', fg: '#115E59', dot: '#14B8A6' };
export const payTone = (code: string): Tone => PAYMENT_TONE[code] ?? CUSTOM_TONE;

const fullName = (e: BookEntry) => `${e.reg.lastName} ${e.reg.firstName}`.trim();

/**
 * «Книга» — все заселённые гости. Добавить = регистрация с заселением,
 * после выселения гость уходит в архив. Подселение — из раздела «Номера».
 */
@Component({
  selector: 'app-book',
  imports: [
    CheckoutDialog,
    PayLabelPipe,
    FormsModule,
    TranslocoPipe,
    ButtonModule,
    Dialog,
    Icon,
    Sheet,
    DataGrid,
    RegistrationForm,
    RegistrationTabs,
    BlacklistDialog,
    GuestInfoDialog,
    SumPipe,
    DayMonthPipe,
  ],
  templateUrl: './book.html',
})
export class BookPage {
  private readonly book = inject(BookService);
  private readonly blacklist = inject(BlacklistService);
  private readonly notify = inject(NotifyService);
  private readonly transloco = inject(TranslocoService);
  private readonly lang = inject(LanguageService);
  private readonly payTypes = inject(PaymentTypesService);
  private readonly router = inject(Router);
  private readonly roomsApi = inject(RoomsService);
  private readonly checkoutDialog = viewChild.required(CheckoutDialog);
  protected readonly checkoutLoading = signal(false);
  protected readonly bp = inject(BreakpointService);

  /** ?register=1&room=103 — сразу открыть заселение в номер (из раздела «Номера»). */
  readonly register = input<string | undefined>();
  readonly room = input<string | undefined>();

  private readonly bookRes = rxResource({ stream: () => this.book.list() });
  protected readonly entries = linkedSignal<BookEntry[]>(() =>
    this.bookRes.hasValue() ? this.bookRes.value() : [],
  );
  protected readonly loading = computed(() => this.bookRes.isLoading());

  /** Меняется при изменении чёрного списка — пересчитать отметки. */
  private readonly bannedTick = signal(0);
  protected readonly filter = signal<PayFilter>('all');
  protected readonly search = signal('');

  protected readonly allRows = computed<BookRow[]>(() => {
    this.bannedTick();
    return this.entries().map((e) => ({ ...e, banned: this.blacklist.find(e.reg.doc) !== null }));
  });
  protected readonly rows = computed(() => {
    const f = this.filter();
    return this.allRows().filter((r) => f === 'all' || r.reg.payment === f);
  });
  /** Фильтр по типу платежа: «Все» + способы, которые есть в книге. */
  protected readonly chips = computed(() => {
    const list = this.allRows();
    const all = { key: 'all' as PayFilter, count: list.length, dot: '#475467' };
    return [
      all,
      ...this.payTypes
        .items()
        .map((t) => t.code)
        .concat(list.map((r) => r.reg.payment))
        .filter((key, i, all) => all.indexOf(key) === i)
        .map((key) => ({
          key: key as PayFilter,
          count: list.filter((r) => r.reg.payment === key).length,
          dot: payTone(key).dot,
        }))
        .filter((c) => c.count > 0),
    ];
  });

  protected readonly selectedId = signal<number | null>(null);
  protected readonly selected = computed(
    () => this.allRows().find((r) => r.id === this.selectedId()) ?? null,
  );

  constructor() {
    this.payTypes.ensureLoaded();
    effect(() => {
      if (this.register()) {
        this.openAdd(this.room() ?? null);
      }
    });
  }

  // ===== Таблица =====
  protected readonly columns = computed<ColDef<BookRow>[]>(() => {
    this.lang.current();
    const t = (k: string) => this.transloco.translate(k);
    const dt = (iso?: string) => formatDateTime(iso);
    return [
      {
        colId: 'name',
        headerName: t('guests.col.name'),
        flex: 1.6,
        minWidth: 200,
        valueGetter: (p) => (p.data ? fullName(p.data) : ''),
        cellRenderer: (p: { value: string; data?: BookRow }) =>
          avatarCell(
            p.value,
            p.data?.banned ? { bg: '#FEE4E2', fg: '#B42318', sub: t('book.banned') } : {},
          ),
      },
      {
        colId: 'doc',
        headerName: t('guests.col.doc'),
        flex: 1.1,
        valueGetter: (p) => p.data?.reg.doc ?? '',
        cellClass: 'tabular-nums text-ink-2',
      },
      {
        colId: 'country',
        headerName: t('guests.col.country'),
        flex: 1.1,
        valueGetter: (p) => (p.data ? t('countries.' + p.data.reg.country) : ''),
        cellClass: 'text-ink-2',
      },
      {
        colId: 'room',
        headerName: t('guests.col.room'),
        flex: 0.7,
        minWidth: 90,
        valueGetter: (p) => p.data?.reg.room ?? '',
        cellClass: 'text-ink-2',
      },
      {
        colId: 'checkin',
        headerName: t('guests.col.checkin'),
        flex: 1.1,
        sort: 'desc',
        valueGetter: (p) => p.data?.reg.checkin ?? '',
        minWidth: 160,
        valueFormatter: (p) => dt(p.value),
        ...dateFilter<BookRow>(),
        cellClass: 'text-ink-2',
      },
      {
        colId: 'sum',
        headerName: t('guests.col.sum'),
        flex: 1,
        minWidth: 120,
        valueGetter: (p) => p.data?.reg.amount ?? 0,
        valueFormatter: (p) => formatSum(p.value),
        ...sumFilter<BookRow>(),
        cellClass: 'font-semibold tabular-nums',
      },
      {
        colId: 'payment',
        headerName: t('book.col.payment'),
        flex: 1.4,
        minWidth: 190,
        valueGetter: (p) => (p.data ? this.payTypes.label(p.data.reg.payment) : ''),
        cellRenderer: (p: { value: string; data?: BookRow }) => {
          if (!p.data) {
            return '';
          }
          const tone = payTone(p.data.reg.payment);
          return pillCell(p.value, tone.bg, tone.fg, tone.dot);
        },
      },
    ];
  });

  protected readonly rowId = (p: { data: BookRow }) => String(p.data.id);

  protected select(row: BookRow | null): void {
    this.selectedId.set(row?.id ?? null);
  }

  /** «Выселить» — то же окно, что в «Номерах»; выбранный гость отмечен сразу. */
  protected openCheckout(): void {
    const r = this.selected();
    if (!r) {
      return;
    }
    this.checkoutLoading.set(true);
    this.roomsApi.list().subscribe({
      next: (rooms) => {
        this.checkoutLoading.set(false);
        const room = rooms.find((x) => x.number === r.reg.room);
        if (!room?.guests.length) {
          this.notify.error('common.errorTitle', 'errors.common.unknown');
          return;
        }
        this.sheetOpen.set(false);
        this.checkoutDialog().open(room, [r.reg.doc]);
      },
      error: () => {
        this.checkoutLoading.set(false);
        this.notify.error('common.errorTitle', 'errors.common.unknown');
      },
    });
  }

  /** После выселения гость ушёл в архив — обновить книгу. */
  protected onCheckedOut(): void {
    this.selectedId.set(null);
    this.reload();
  }

  protected reload(): void {
    this.bookRes.reload();
  }

  // ===== Мобильная версия =====
  protected readonly mobileRows = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.rows().filter(
      (r) =>
        !q ||
        fullName(r).toLowerCase().includes(q) ||
        r.reg.doc.toLowerCase().includes(q) ||
        r.reg.room.includes(q),
    );
  });
  protected readonly sheetOpen = signal(false);
  protected readonly tone = payTone;

  protected initials(r: BookEntry): string {
    return initials(fullName(r));
  }

  protected name(r: BookEntry): string {
    return fullName(r);
  }

  // ===== Полная информация (двойной клик / «Подробнее» на мобильном) =====
  protected readonly infoOpen = signal(false);
  protected readonly info = computed<GuestInfo | null>(() => {
    const r = this.selected();
    return r ? this.toInfo(r) : null;
  });

  protected openInfo(row: BookRow): void {
    this.selectedId.set(row.id);
    this.fromSheet();
    this.infoOpen.set(true);
  }

  /** Из карточки — сразу к редактированию. */
  protected editFromInfo(): void {
    this.infoOpen.set(false);
    this.openEdit();
  }

  private toInfo(r: BookRow): GuestInfo {
    const g: GuestRegistration = r.reg;
    const dt = (iso: string | null) => (iso ? `${formatDmy(iso)}, ${formatTime(iso)}` : '');
    const foreign = g.foreign
      ? [
          { label: 'guests.reg.visa', value: g.visaType ? 'visa.' + g.visaType : '', translate: true },
          { label: 'guests.reg.entryDate', value: formatDmy(g.entryDate) },
          { label: 'guests.reg.entryPoint', value: g.entryPoint },
        ]
      : [];
    return {
      name: `${g.lastName} ${g.firstName} ${g.middleName}`.trim(),
      sub: `${g.doc} · ${this.transloco.translate('guests.col.room')} ${g.room}`,
      banned: r.banned,
      bannedReason: this.blacklist.find(g.doc)?.reason,
      sections: [
        {
          title: 'guests.reg.document',
          items: [
            { label: 'guests.reg.docType', value: 'docTypes.' + g.docType, translate: true },
            { label: 'guests.reg.docNumber', value: g.doc },
            { label: 'guests.reg.issuedAt', value: formatDmy(g.issuedAt) },
            { label: 'guests.reg.expiresAt', value: formatDmy(g.expiresAt) },
            { label: 'guests.reg.issuedBy', value: g.issuedBy, wide: true },
          ],
        },
        {
          title: 'guests.reg.personal',
          items: [
            { label: 'guests.reg.birthDate', value: formatDmy(g.birthDate) },
            { label: 'guests.reg.sex', value: 'sex.' + g.sex, translate: true },
            { label: 'guests.reg.country', value: 'countries.' + g.country, translate: true },
            { label: 'guests.reg.nationality', value: g.nationality },
            { label: 'guests.reg.phone', value: g.phone },
            { label: 'guests.reg.cityFrom', value: g.cityFrom },
            { label: 'guests.reg.address', value: g.address, wide: true },
            ...foreign,
          ],
        },
        {
          title: 'guests.reg.stay',
          items: [
            { label: 'guests.reg.room', value: g.room },
            { label: 'guests.reg.purpose', value: 'purpose.' + g.purpose, translate: true },
            { label: 'guests.reg.checkin', value: dt(g.checkin) },
            {
              label: 'guests.reg.amount',
              value: `${formatSum(g.amount)} ${this.transloco.translate('common.currency')}`,
            },
            { label: 'guests.reg.payment', value: this.payTypes.label(g.payment) },
          ],
        },
      ],
    };
  }

  protected openCard(r: BookRow): void {
    this.selectedId.set(r.id);
    this.sheetOpen.set(true);
  }

  /** Из шторки на мобильном — закрыть её и открыть диалог. */
  private fromSheet(): void {
    this.sheetOpen.set(false);
  }

  // ===== Добавить / Подселить =====
  protected readonly regOpen = signal(false);
  protected readonly presetRoom = signal<string | null>(null);

  protected openAdd(room: string | null = null): void {
    this.presetRoom.set(room);
    this.regOpen.set(true);
  }

  protected closeReg(saved: boolean): void {
    this.regOpen.set(false);
    if (saved) {
      this.reload();
    }
    if (this.register()) {
      this.router.navigate([], { queryParams: {}, replaceUrl: true });
    }
  }

  // ===== Изменить =====
  protected readonly editOpen = signal(false);
  protected readonly editSaving = signal(false);
  private readonly editForm = viewChild<RegistrationForm>('editForm');

  protected openEdit(): void {
    if (!this.selected()) {
      return;
    }
    this.fromSheet();
    this.editOpen.set(true);
  }

  protected saveEdit(): void {
    const row = this.selected();
    const form = this.editForm();
    if (!row || !form || this.editSaving()) {
      return;
    }
    const check = form.collect();
    if (!check.ok) {
      this.notify.error(check.title, check.text, check.params);
      return;
    }
    this.editSaving.set(true);
    this.book.update(row.id, check.data, !!row.receipt).subscribe({
      next: (e) => {
        this.editSaving.set(false);
        this.editOpen.set(false);
        this.entries.update((list) => list.map((x) => (x.id === e.id ? e : x)));
        this.notify.success('common.savedTitle', 'book.toast.updatedText', { name: fullName(e) });
      },
      error: (e: unknown) => this.fail(() => this.editSaving.set(false), e),
    });
  }

  // ===== В чёрный список =====
  protected readonly blOpen = signal(false);
  protected readonly blPerson = computed<BlacklistPerson | null>(() => {
    const r = this.selected();
    return r
      ? {
          doc: r.reg.doc,
          lastName: r.reg.lastName,
          firstName: r.reg.firstName,
          middleName: r.reg.middleName,
          country: r.reg.country,
        }
      : null;
  });

  protected openBlacklist(): void {
    const row = this.selected();
    if (!row) {
      return;
    }
    if (row.banned) {
      this.notify.error('blacklist.toast.existsTitle', 'blacklist.toast.existsText', {
        doc: row.reg.doc,
      });
      return;
    }
    this.fromSheet();
    this.blOpen.set(true);
  }

  protected onBlacklisted(): void {
    this.bannedTick.update((n) => n + 1);
  }

  private fail(reset: () => void, e?: unknown): void {
    reset();
    this.notify.error(
      'common.saveError',
      e instanceof ApiError ? `errors.${e.code}` : 'errors.common.unknown',
    );
  }
}
