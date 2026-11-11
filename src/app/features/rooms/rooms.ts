import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { ApiError, APP_TODAY } from '../../core/api/mock-api';
import { StaffService } from '../../core/data/staff.service';
import { BookService } from '../../core/data/book.service';
import { RoomQrService } from '../../core/data/room-qr.service';
import { RoomsService } from '../../core/data/rooms.service';
import { SettingsService } from '../../core/data/settings.service';
import { FiscalReceiptData } from '../../core/docs/fiscal-receipt-doc';
import { BreakpointService } from '../../core/layout/breakpoint.service';
import { NotifyService } from '../../core/notify/notify.service';
import { Room, RoomStatus } from '../../core/models';
import {
  formatDmy,
  formatSum,
  initials,
  isoToLocalDate,
  localDateTimeToIso,
} from '../../shared/format/format';
import { DayMonthPipe, PluralPipe, SumPipe } from '../../shared/format/format.pipes';
import { sumInWords } from '../../shared/format/sum-in-words';
import { SumInputDirective } from '../../shared/forms/sum-input.directive';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog/confirm-dialog';
import { FiscalReceiptDialog } from '../../shared/ui/fiscal-receipt/fiscal-receipt-dialog';
import { Icon } from '../../shared/ui/icon/icon';
import { PayBadge, RoomStatusBadge } from '../../shared/ui/status/badges';
import { ROOM_STATUSES, ROOM_TONE } from '../../shared/ui/status/status-styles';
import { Sheet } from '../../shared/ui/sheet/sheet';
import { RoomQr } from './room-qr';
import { RegistrationTabs } from '../guests/registration-form/registration-tabs';

type StatusFilter = RoomStatus | 'all';

@Component({
  selector: 'app-rooms',
  imports: [
    NgTemplateOutlet,
    FormsModule,
    ReactiveFormsModule,
    TranslocoPipe,
    ButtonModule,
    Checkbox,
    Dialog,
    DatePicker,
    InputText,
    Select,
    Textarea,
    Icon,
    RoomStatusBadge,
    PayBadge,
    Sheet,
    RoomQr,
    RegistrationTabs,
    SumInputDirective,
    SumPipe,
    DayMonthPipe,
    PluralPipe,
    FiscalReceiptDialog,
    ConfirmDialog,
  ],
  templateUrl: './rooms.html',
})
export class RoomsPage {
  private readonly roomsApi = inject(RoomsService);
  private readonly book = inject(BookService);
  protected readonly qrApi = inject(RoomQrService);
  private readonly settingsApi = inject(SettingsService);
  private readonly notify = inject(NotifyService);
  /** ФИО дежурного администратора для подписи в чеке. */
  private readonly staff = inject(StaffService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly bp = inject(BreakpointService);
  protected readonly today = inject(APP_TODAY);

  private readonly roomsRes = rxResource({ stream: () => this.roomsApi.list() });
  private readonly categoriesRes = rxResource({ stream: () => this.settingsApi.listCategories() });

  /** Локальная копия списка: действия меняют её сразу, без перезагрузки. */
  protected readonly rooms = linkedSignal<Room[]>(() =>
    this.roomsRes.hasValue() ? this.roomsRes.value() : [],
  );
  protected readonly loading = computed(() => this.roomsRes.isLoading());
  protected readonly categories = computed(() =>
    this.categoriesRes.hasValue() ? this.categoriesRes.value() : [],
  );

  protected readonly filter = signal<StatusFilter>('all');
  protected readonly floor = signal<number | null>(null);
  protected readonly selectedNumber = signal<string | null>(null);
  protected readonly actionBusy = signal(false);

  protected readonly floors = computed(() =>
    [...new Set(this.rooms().map((r) => r.floor))].sort((a, b) => a - b),
  );

  protected readonly chips = computed(() => {
    const list = this.rooms();
    const all = { key: 'all' as StatusFilter, dot: '#475467', count: list.length };
    return [
      all,
      ...ROOM_STATUSES.map((s) => ({
        key: s as StatusFilter,
        dot: ROOM_TONE[s].dot,
        count: list.filter((r) => r.status === s).length,
      })),
    ];
  });

  protected readonly visible = computed(() => {
    const f = this.filter();
    const floor = this.floor();
    return this.rooms().filter(
      (r) => (f === 'all' || r.status === f) && (floor === null || r.floor === floor),
    );
  });

  protected readonly selected = computed(
    () => this.rooms().find((r) => r.number === this.selectedNumber()) ?? null,
  );

  /** Гость, выбранный в селекте (несколько гостей в номере); null — первый. */
  protected readonly pickedGuest = signal<string | null>(null);
  protected readonly shownGuest = computed(() => {
    const guests = this.selected()?.guests ?? [];
    return guests.find((g) => g.doc === this.pickedGuest()) ?? guests[0] ?? null;
  });

  protected readonly selectedPrice = computed(() => {
    const room = this.selected();
    return room ? (this.categories().find((c) => c.name === room.category)?.price ?? null) : null;
  });

  protected readonly skeletons = Array.from({ length: 12 }, (_, i) => i);
  protected readonly tones = ROOM_TONE;

  // ----- Мобильная шторка -----
  protected readonly sheetOpen = computed(() => this.bp.isMobile() && this.selected() !== null);

  protected onSheetVisible(open: boolean): void {
    if (!open) {
      this.selectedNumber.set(null);
    }
  }

  // ----- Добавление номера -----
  protected readonly addOpen = signal(false);
  protected readonly addTried = signal(false);
  protected readonly saving = signal(false);
  protected readonly floorOptions = [1, 2, 3, 4, 5];
  protected readonly bedOptions = [1, 2, 3, 4];
  protected readonly addForm = this.fb.group({
    number: ['', [Validators.required, Validators.pattern(/^\d{1,4}[A-Za-zА-Яа-я]?$/)]],
    floor: [2],
    category: ['Стандарт'],
    beds: [2],
    price: this.fb.control<number | null>(null),
    qr: [false],
  });

  // ----- Изменение номера -----
  /** Номер, который редактируется; null — форма добавления. */
  protected readonly editNumber = signal<string | null>(null);
  private readonly formQr = signal(false);

  /** Подсказка под чекбоксом QR: зависит от того, был ли код у номера раньше. */
  protected readonly qrHint = computed(() => {
    if (this.qrApi.error()) {
      return 'rooms.form.qrOffline';
    }
    const edit = this.editNumber();
    const had = edit !== null && this.qrApi.isEnabled(edit);
    if (this.formQr()) {
      return had ? 'rooms.form.qrHintKeep' : 'rooms.form.qrHintCreate';
    }
    return had ? 'rooms.form.qrHintOff' : 'rooms.form.qrHintNew';
  });

  // ----- QR-код номера -----
  protected readonly qrOpen = signal(false);
  protected readonly qrRoom = signal<Room | null>(null);

  // ----- Продление -----
  protected readonly extendOpen = signal(false);
  protected readonly extendDate = signal<Date | null>(null);

  // ----- Выселение (выбор гостей, если их в номере несколько) -----
  protected readonly checkoutOpen = signal(false);
  protected readonly checkoutRoom = signal<Room | null>(null);
  /** Документы отмеченных к выселению гостей. */
  protected readonly checkoutDocs = signal<string[]>([]);
  /** Итоговая сумма к оплате при выезде. */
  protected readonly checkoutAmount = signal<number | null>(null);
  /** Номер сформированного фискального чека. */
  protected readonly receipt = signal<string | null>(null);
  protected readonly receiptBusy = signal(false);
  /** Данные последнего чека — для повторного просмотра и сохранения в архив. */
  private receiptData: FiscalReceiptData | null = null;
  /** Окно просмотра чека (как в «Книге» и «Архиве»): скачать Word / печать. */
  protected readonly receiptOpen = signal(false);
  protected readonly receiptView = signal<FiscalReceiptData | null>(null);
  protected readonly toBlacklist = signal(false);
  protected readonly blacklistReason = signal('');
  protected readonly checkoutTried = signal(false);
  protected readonly checkoutAll = computed(() => {
    const room = this.checkoutRoom();
    return !!room && room.guests.every((g) => this.checkoutDocs().includes(g.doc));
  });

  constructor() {
    this.qrApi.load().subscribe();
    this.addForm.controls.qr.valueChanges.subscribe((v) => this.formQr.set(v));
  }

  select(room: Room): void {
    this.selectedNumber.set(room.number);
    this.pickedGuest.set(null);
  }

  /** Свободные места в занятом номере (для свободного/уборки/ремонта — 0, не показываем). */
  protected freeBeds(room: Room): number {
    return room.status === 'busy' ? Math.max(0, room.beds - room.guests.length) : 0;
  }

  protected tone(room: Room) {
    return ROOM_TONE[room.status];
  }

  /** Подсказка на карточке номера. */
  protected hint(room: Room): { key: string; date?: string; text?: string } {
    if (room.status === 'busy' && room.guests.length) {
      const out = this.lastCheckout(room).slice(0, 10);
      return out === this.today
        ? { key: 'rooms.hint.checkoutToday' }
        : { key: 'rooms.hint.checkout', date: out };
    }
    if (room.note) {
      return { key: '', text: room.note };
    }
    return { key: `rooms.hint.${room.status}` };
  }

  protected guestInitials(name: string): string {
    return initials(name);
  }

  /** Самая поздняя дата выезда среди гостей номера. */
  protected lastCheckout(room: Room): string {
    return room.guests.reduce((max, g) => (g.checkout > max ? g.checkout : max), '');
  }

  /** Итоговая сумма по всем гостям номера. */
  protected totalSum(room: Room): number {
    return room.guests.reduce((sum, g) => sum + g.sum, 0);
  }

  protected guestNames(room: Room): string {
    return room.guests.map((g) => g.name).join(', ');
  }

  /** Выселение = закрытие клиента: выбор гостей, сумма, фискальный чек, чёрный список. */
  protected checkout(room: Room): void {
    this.openCheckout(room);
  }

  protected markReady(room: Room): void {
    this.actionBusy.set(true);
    this.roomsApi.markReady(room.number).subscribe({
      next: (updated) => {
        this.replace(updated);
        this.actionBusy.set(false);
        this.notify.success('rooms.toast.readyTitle', 'rooms.toast.readyText', {
          room: room.number,
        });
      },
      error: (e: unknown) => this.fail(e),
    });
  }

  // ----- Удаление номера -----
  protected readonly deleteRoom = signal<Room | null>(null);
  protected readonly deleteOpen = signal(false);

  /** Номер с проживающими гостями удалить нельзя. */
  protected canDelete(room: Room): boolean {
    return room.guests.length === 0 && room.status !== 'busy';
  }

  protected askDelete(room: Room): void {
    if (!this.canDelete(room)) {
      this.notify.error('rooms.toast.deleteBusyTitle', 'rooms.toast.deleteBusyText', {
        room: room.number,
      });
      return;
    }
    this.deleteRoom.set(room);
    this.deleteOpen.set(true);
  }

  protected doDelete(): void {
    const room = this.deleteRoom();
    if (!room) {
      return;
    }
    this.saving.set(true);
    this.roomsApi.remove(room.number).subscribe({
      next: () => {
        this.saving.set(false);
        this.deleteOpen.set(false);
        this.rooms.update((list) => list.filter((r) => r.number !== room.number));
        if (this.selectedNumber() === room.number) {
          this.selectedNumber.set(null);
        }
        this.notify.success('rooms.toast.deletedTitle', 'rooms.toast.deletedText', {
          room: room.number,
        });
      },
      error: (e: unknown) => {
        this.saving.set(false);
        this.deleteOpen.set(false);
        if (e instanceof ApiError && e.code === 'rooms.hasGuests') {
          this.notify.error('rooms.toast.deleteBusyTitle', 'rooms.toast.deleteBusyText', {
            room: room.number,
          });
        } else {
          this.notify.error(
            'common.saveError',
            e instanceof ApiError ? `errors.${e.code}` : 'errors.common.unknown',
          );
        }
      },
    });
  }

  // ----- Заселение (на этой же странице) -----
  protected readonly regOpen = signal(false);
  protected readonly regRoom = signal<string | null>(null);

  /** Заселение в свободный номер или подселение, если есть свободные места. */
  protected checkIn(room: Room): void {
    this.regRoom.set(room.number);
    this.regOpen.set(true);
  }

  /** После регистрации — обновить номера, остаться на странице и показать номер. */
  protected onCheckedIn(): void {
    this.regOpen.set(false);
    const room = this.regRoom();
    this.roomsApi.list().subscribe((list) => {
      this.rooms.set(list);
      if (room) {
        this.selectedNumber.set(room);
        this.pickedGuest.set(null);
      }
    });
  }

  protected openCheckout(room: Room): void {
    this.checkoutRoom.set(room);
    this.checkoutDocs.set(room.guests.map((g) => g.doc));
    this.checkoutAmount.set(this.totalSum(room) || null);
    this.receipt.set(null);
    this.receiptData = null;
    this.toBlacklist.set(false);
    this.blacklistReason.set('');
    this.checkoutTried.set(false);
    if (this.bp.isMobile()) {
      this.selectedNumber.set(null);
    }
    this.checkoutOpen.set(true);
  }

  protected isChecked(doc: string): boolean {
    return this.checkoutDocs().includes(doc);
  }

  protected toggleGuest(doc: string, on: boolean): void {
    this.checkoutDocs.update((list) =>
      on ? [...new Set([...list, doc])] : list.filter((d) => d !== doc),
    );
  }

  protected toggleAllGuests(on: boolean): void {
    const room = this.checkoutRoom();
    this.checkoutDocs.set(on && room ? room.guests.map((g) => g.doc) : []);
  }

  /** Сумма изменилась — ранее выданный чек уже не соответствует. */
  protected setAmount(v: number | null): void {
    this.checkoutAmount.set(v);
    this.receipt.set(null);
    this.receiptData = null;
  }

  protected generateReceipt(): void {
    const room = this.checkoutRoom();
    const amount = this.checkoutAmount();
    if (!room || !amount) {
      this.notify.error('rooms.toast.receiptNoSumTitle', 'rooms.toast.receiptNoSumText');
      return;
    }
    const docs = this.checkoutDocs();
    const leaving = room.guests.filter((g) => docs.includes(g.doc));
    this.receiptBusy.set(true);
    this.book.fiscalReceipt(room.number, amount, docs).subscribe({
      next: (r) => {
        const checkin = leaving.reduce(
          (min, g) => (!min || g.checkin < min ? g.checkin : min),
          '',
        );
        const nights = nightsBetween(checkin, this.today);
        const first = leaving[0]?.name ?? '';
        // Бланк гостиницы на русском/английском — текст строк не зависит от языка интерфейса.
        this.receiptData = {
          number: r.number,
          date: formatDmy(this.today),
          guests: leaving.length > 1 ? `${first} (+${leaving.length - 1})` : first,
          company: '_'.repeat(28),
          room: room.number,
          checkin: formatDmy(checkin),
          checkout: formatDmy(this.today),
          items: [
            {
              name: `Проживание · ${room.category}`,
              qty: String(nights),
              price: formatSum(Math.round(amount / nights)),
              sum: formatSum(amount),
            },
          ],
          amount: formatSum(amount),
          amountWords: sumInWords(amount),
          cashier: this.staff.myName(),
        };
        this.receipt.set(r.number);
        this.receiptBusy.set(false);
        this.showReceipt();
      },
      error: (e: unknown) => {
        this.receiptBusy.set(false);
        this.notify.error(
          'common.saveError',
          e instanceof ApiError ? `errors.${e.code}` : 'errors.common.unknown',
        );
      },
    });
  }

  /** Показать сформированный чек в окне (там — «Скачать» и «Печать»). */
  protected showReceipt(): void {
    if (this.receiptData) {
      this.receiptView.set(this.receiptData);
      this.receiptOpen.set(true);
    }
  }

  protected reasonInvalid(): boolean {
    return this.checkoutTried() && this.toBlacklist() && !this.blacklistReason().trim();
  }

  protected confirmCheckout(): void {
    const room = this.checkoutRoom();
    const docs = this.checkoutDocs();
    if (!room || !docs.length) {
      return;
    }
    this.checkoutTried.set(true);
    if (this.reasonInvalid()) {
      this.notify.error('common.requiredTitle', 'blacklist.toast.required');
      return;
    }
    const leaving = room.guests.filter((g) => docs.includes(g.doc));
    const banned = this.toBlacklist();
    this.actionBusy.set(true);
    this.book
      .checkout(room.number, docs, {
        amount: this.checkoutAmount() ?? 0,
        receipt: this.receipt(),
        receiptData: this.receipt() ? this.receiptData : null,
        blacklistReason: banned ? this.blacklistReason().trim() : null,
      })
      .subscribe({
      next: (updated) => {
        this.replace(updated);
        this.actionBusy.set(false);
        this.checkoutOpen.set(false);
        if (updated.guests.length) {
          this.notify.success('rooms.toast.checkedOutPartTitle', 'rooms.toast.checkedOutPartText', {
            count: leaving.length,
            room: room.number,
            left: updated.guests.length,
          });
        } else {
          this.notify.success('rooms.toast.checkedOutTitle', 'rooms.toast.checkedOutText', {
            name: leaving.map((g) => g.name).join(', '),
            room: room.number,
          });
        }
        if (banned) {
          setTimeout(
            () =>
              this.notify.success('blacklist.toast.addedTitle', 'blacklist.toast.addedText', {
                name: leaving.map((g) => g.name).join(', '),
              }),
            2500,
          );
        }
      },
      error: (e: unknown) => this.fail(e),
    });
  }

  protected openExtend(room: Room): void {
    this.extendDate.set(isoToLocalDate(this.lastCheckout(room) || undefined));
    this.extendOpen.set(true);
  }

  protected saveExtend(room: Room): void {
    const iso = localDateTimeToIso(this.extendDate());
    const checkin = room.guests[0]?.checkin;
    if (!iso || !checkin || iso <= checkin) {
      this.notify.error('common.saveError', 'rooms.toast.extendInvalid');
      return;
    }
    this.actionBusy.set(true);
    this.roomsApi.extend(room.number, iso).subscribe({
      next: (updated) => {
        this.replace(updated);
        this.actionBusy.set(false);
        this.extendOpen.set(false);
        this.notify.success('rooms.toast.extendedTitle', 'rooms.toast.extendedText', {
          room: room.number,
        });
      },
      error: (e: unknown) => this.fail(e),
    });
  }

  protected openAdd(): void {
    this.editNumber.set(null);
    this.addForm.reset({
      number: '',
      floor: 2,
      category: this.categories()[0]?.name ?? '',
      beds: 2,
      price: null,
      qr: false,
    });
    this.syncQrControl();
    this.addTried.set(false);
    this.addOpen.set(true);
  }

  protected openEdit(room: Room): void {
    this.editNumber.set(room.number);
    this.addForm.reset({
      number: room.number,
      floor: room.floor,
      category: room.category,
      beds: room.beds,
      price: null,
      qr: this.qrApi.isEnabled(room.number),
    });
    this.syncQrControl();
    this.addTried.set(false);
    this.selectedNumber.set(this.bp.isMobile() ? null : room.number);
    this.addOpen.set(true);
  }

  protected openQr(room: Room): void {
    this.qrRoom.set(room);
    if (this.bp.isMobile()) {
      this.selectedNumber.set(null);
    }
    this.qrOpen.set(true);
  }

  /** Без сервера комментариев чекбокс QR недоступен. */
  private syncQrControl(): void {
    this.formQr.set(this.addForm.controls.qr.value);
    if (this.qrApi.error()) {
      this.addForm.controls.qr.disable({ emitEvent: false });
    } else {
      this.addForm.controls.qr.enable({ emitEvent: false });
    }
  }

  protected saveRoom(): void {
    this.addTried.set(true);
    if (this.addForm.invalid) {
      this.notify.error('common.saveError', 'rooms.toast.numberRequired');
      return;
    }
    const { qr, ...v } = this.addForm.getRawValue();
    const data = { ...v, number: v.number.trim() };
    const edit = this.editNumber();
    const qrBefore = edit !== null && this.qrApi.isEnabled(edit);
    const qrChanged = !this.qrApi.error() && (qr !== qrBefore || (qr && edit !== data.number));
    const req = edit === null ? this.roomsApi.add(data) : this.roomsApi.update(edit, data);
    this.saving.set(true);
    req.subscribe({
      next: (room) => {
        const done = (qrOk: boolean) => {
          this.saving.set(false);
          this.addOpen.set(false);
          if (edit === null) {
            this.rooms.update((list) => [...list, room]);
          } else {
            this.rooms.update((list) => list.map((r) => (r.number === edit ? room : r)));
          }
          this.selectedNumber.set(this.bp.isMobile() ? null : room.number);
          if (!qrOk) {
            this.notify.error('rooms.toast.qrFailedTitle', 'rooms.toast.qrFailedText');
          } else if (edit === null) {
            this.notify.success(
              'rooms.toast.addedTitle',
              qr ? 'rooms.toast.qrCreatedText' : 'rooms.toast.addedText',
              { room: room.number, category: room.category },
            );
          } else {
            this.notify.success('common.savedTitle', 'rooms.toast.updatedText', {
              room: room.number,
            });
          }
          // Код только что включили — сразу показать его для печати.
          if (qrOk && qr && !qrBefore) {
            this.openQr(room);
          }
        };
        if (!qrChanged) {
          done(true);
          return;
        }
        this.qrApi.setEnabled(room.number, qr, edit ?? undefined).subscribe({
          next: () => done(true),
          error: () => done(false),
        });
      },
      error: (e: unknown) => {
        this.saving.set(false);
        if (e instanceof ApiError && e.code === 'rooms.exists') {
          this.notify.error('rooms.toast.existsTitle', 'rooms.toast.existsText', {
            number: data.number.trim(),
          });
        } else {
          this.notify.error(
            'common.saveError',
            e instanceof ApiError ? `errors.${e.code}` : 'errors.common.unknown',
          );
        }
      },
    });
  }

  protected numberInvalid(): boolean {
    return this.addTried() && this.addForm.controls.number.invalid;
  }

  private replace(room: Room): void {
    this.rooms.update((list) => list.map((r) => (r.number === room.number ? room : r)));
  }

  private fail(e?: unknown): void {
    this.actionBusy.set(false);
    this.notify.error(
      'common.saveError',
      e instanceof ApiError ? `errors.${e.code}` : 'errors.common.unknown',
    );
  }
}

/** Количество ночей между датой заезда и выезда (минимум 1). */
function nightsBetween(checkin: string, checkout: string): number {
  if (!checkin) {
    return 1;
  }
  const a = Date.UTC(+checkin.slice(0, 4), +checkin.slice(5, 7) - 1, +checkin.slice(8, 10));
  const b = Date.UTC(+checkout.slice(0, 4), +checkout.slice(5, 7) - 1, +checkout.slice(8, 10));
  return Math.max(1, Math.round((b - a) / 86_400_000));
}
