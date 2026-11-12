import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, linkedSignal, signal, viewChild } from '@angular/core';
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
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { ApiError, APP_TODAY } from '../../core/api/mock-api';
import { RoomQrService } from '../../core/data/room-qr.service';
import { RoomsService } from '../../core/data/rooms.service';
import { SettingsService } from '../../core/data/settings.service';
import { BreakpointService } from '../../core/layout/breakpoint.service';
import { NotifyService } from '../../core/notify/notify.service';
import { Room, RoomStatus } from '../../core/models';
import { initials } from '../../shared/format/format';
import { DayMonthPipe, PluralPipe, SumPipe } from '../../shared/format/format.pipes';
import { SumInputDirective } from '../../shared/forms/sum-input.directive';
import { DigitsInputDirective } from '../../shared/forms/digits-input.directive';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog/confirm-dialog';
import { Icon } from '../../shared/ui/icon/icon';
import { PayBadge, RoomStatusBadge } from '../../shared/ui/status/badges';
import { ROOM_STATUSES, ROOM_TONE } from '../../shared/ui/status/status-styles';
import { Sheet } from '../../shared/ui/sheet/sheet';
import { RoomQr } from './room-qr';
import { CheckoutDialog } from './checkout-dialog';
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
    InputText,
    Select,
    Icon,
    RoomStatusBadge,
    PayBadge,
    Sheet,
    RoomQr,
    CheckoutDialog,
    RegistrationTabs,
    SumInputDirective,
    DigitsInputDirective,
    SumPipe,
    DayMonthPipe,
    PluralPipe,
    ConfirmDialog,
  ],
  templateUrl: './rooms.html',
})
export class RoomsPage {
  private readonly roomsApi = inject(RoomsService);
  protected readonly qrApi = inject(RoomQrService);
  private readonly settingsApi = inject(SettingsService);
  private readonly notify = inject(NotifyService);
  /** ФИО дежурного администратора для подписи в чеке. */
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
  protected readonly addForm = this.fb.group({
    number: ['', [Validators.required, Validators.pattern(/^\d{1,4}[A-Za-zА-Яа-я]?$/)]],
    floor: [2],
    category: ['Стандарт'],
    beds: this.fb.control<number | null>(2, [Validators.required, Validators.min(1), Validators.max(99)]),
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

  private readonly checkoutDialog = viewChild.required(CheckoutDialog);

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
      const since = this.firstCheckin(room).slice(0, 10);
      return since === this.today
        ? { key: 'rooms.hint.checkinToday' }
        : { key: 'rooms.hint.checkin', date: since };
    }
    if (room.note) {
      return { key: '', text: room.note };
    }
    return { key: `rooms.hint.${room.status}` };
  }

  protected guestInitials(name: string): string {
    return initials(name);
  }

  /** Самая ранняя дата заезда среди гостей номера. */
  protected firstCheckin(room: Room): string {
    return room.guests.reduce((min, g) => (!min || g.checkin < min ? g.checkin : min), '');
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
    if (this.bp.isMobile()) {
      this.selectedNumber.set(null);
    }
    this.checkoutDialog().open(room);
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
      this.notify.error(
        'common.saveError',
        this.addForm.controls.number.invalid ? 'rooms.toast.numberRequired' : 'rooms.form.bedsInvalid',
      );
      return;
    }
    const { qr, ...v } = this.addForm.getRawValue();
    const data = { ...v, beds: v.beds ?? 1, number: v.number.trim() };
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

  protected bedsInvalid(): boolean {
    return this.addTried() && this.addForm.controls.beds.invalid;
  }

  protected replace(room: Room): void {
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

