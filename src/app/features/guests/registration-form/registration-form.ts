import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { merge } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { DatePicker } from 'primeng/datepicker';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { ApiError, APP_TODAY } from '../../../core/api/mock-api';
import { BlacklistService } from '../../../core/data/blacklist.service';
import { GuestsService } from '../../../core/data/guests.service';
import { RoomsService } from '../../../core/data/rooms.service';
import { MOCK_COUNTRIES } from '../../../core/mocks/mock-data';
import { NotifyService } from '../../../core/notify/notify.service';
import {
  DocType,
  GuestProfile,
  GuestRegistration,
  PaymentMethod,
  Sex,
  VisaType,
  VisitPurpose,
} from '../../../core/models';
import {
  addDays,
  isoToLocalDate,
  localDateTimeToIso,
  localDateToIso,
} from '../../../shared/format/format';
import { formatDocInput } from '../../../shared/format/format';
import { SumInputDirective } from '../../../shared/forms/sum-input.directive';
import { Icon } from '../../../shared/ui/icon/icon';

/** Счётчик экземпляров: уникальные id полей, когда на экране несколько форм (табы гостей). */
let formSeq = 0;

const REQUIRED = ['doc', 'lastName', 'firstName', 'room', 'amount'] as const;
type RequiredField = (typeof REQUIRED)[number];

/** Данные проживания, которые переносятся в таб следующего гостя. */
export interface RegStay {
  room: string;
  checkin: Date | null;
  checkout: Date | null;
  purpose: VisitPurpose;
}

/** Результат проверки формы без отправки. */
export type RegCheck =
  | { ok: true; data: GuestRegistration }
  | { ok: false; title: string; text: string; params?: Record<string, unknown> };

/**
 * Форма регистрации гостя (требования РУз): документ, личные данные,
 * проживание и оплата. Лупа ищет гостя в архиве и заполняет поля.
 * `compact` — мобильный вариант: редкие поля скрыты под «Дополнительно».
 */
@Component({
  selector: 'app-registration-form',
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    ButtonModule,
    Checkbox,
    DatePicker,
    InputText,
    Select,
    Icon,
    SumInputDirective,
  ],
  templateUrl: './registration-form.html',
})
export class RegistrationForm {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly guests = inject(GuestsService);
  private readonly roomsApi = inject(RoomsService);
  private readonly blacklist = inject(BlacklistService);
  private readonly notify = inject(NotifyService);
  private readonly today = inject(APP_TODAY);

  /** Номер комнаты, выбранный заранее (из карточки номера). */
  readonly presetRoom = input<string | null>(null);
  readonly compact = input(false);
  /** Форма внутри табов нескольких гостей: свои кнопки скрыты, отправку делает обёртка. */
  readonly multi = input(false);
  /** Проживание, скопированное из предыдущего таба. */
  readonly initialStay = input<RegStay | null>(null);
  /** Данные гостя для изменения записи в книге. */
  readonly initial = input<GuestRegistration | null>(null);
  readonly done = output<{ name: string; room: string }>();
  readonly cancel = output<void>();
  /** В режиме `multi` Enter/submit не отправляет одного гостя, а просит обёртку отправить всех. */
  readonly submitRequest = output<void>();

  protected readonly uid = `rg${++formSeq}-`;

  protected readonly foreign = signal(false);
  protected readonly searching = signal(false);
  protected readonly saving = signal(false);
  protected readonly tried = signal(false);
  protected readonly filled = signal(false);
  protected readonly extraOpen = signal(false);
  /** «Фамилия Имя» для подписи таба. */
  readonly displayName = signal('');

  protected readonly countries = MOCK_COUNTRIES;
  protected readonly docTypes: DocType[] = ['bio_passport', 'id_card', 'foreign_passport'];
  protected readonly sexes: Sex[] = ['male', 'female'];
  protected readonly purposes: VisitPurpose[] = ['tourism', 'business', 'private'];
  protected readonly payments: PaymentMethod[] = ['cash', 'uzcard', 'visa', 'transfer', 'unpaid'];
  protected readonly visas: VisaType[] = ['visa_free', 'tourist', 'business'];

  /** Свободные номера и занятые, где ещё есть места (подселение). */
  private readonly roomsRes = rxResource({ stream: () => this.roomsApi.checkInRooms() });
  protected readonly roomOptions = computed(() => {
    const list = this.roomsRes.hasValue() ? this.roomsRes.value() : [];
    const options = list.map((r) => ({ value: r.number, label: `${r.number} · ${r.category}` }));
    for (const room of [this.presetRoom(), this.initial()?.room]) {
      if (room && !options.some((o) => o.value === room)) {
        options.unshift({ value: room, label: room });
      }
    }
    return options;
  });

  protected readonly form = this.fb.group({
    docType: this.fb.control<DocType>('bio_passport'),
    doc: ['', Validators.required],
    issuedAt: this.fb.control<Date | null>(null),
    expiresAt: this.fb.control<Date | null>(null),
    issuedBy: [''],
    lastName: ['', Validators.required],
    firstName: ['', Validators.required],
    middleName: [''],
    birthDate: this.fb.control<Date | null>(null),
    sex: this.fb.control<Sex>('male'),
    country: ['UZ'],
    nationality: [''],
    phone: [''],
    cityFrom: [''],
    address: [''],
    visaType: this.fb.control<VisaType>('visa_free'),
    entryDate: this.fb.control<Date | null>(null),
    entryPoint: [''],
    room: ['', Validators.required],
    checkin: this.fb.control<Date | null>(null),
    checkout: this.fb.control<Date | null>(null),
    purpose: this.fb.control<VisitPurpose>('tourism'),
    amount: this.fb.control<number | null>(null, Validators.required),
    payment: this.fb.control<PaymentMethod>('unpaid'),
    // «Сохранить фискальный чек» — чек формируется при заселении и хранится у гостя.
    // E-mehmon оформляется не в форме регистрации.
    fiscalReceipt: [false],
    sendEmehmon: [false],
  });

  constructor() {
    effect(() => {
      const room = this.presetRoom();
      if (room) {
        this.form.controls.room.setValue(room);
      }
    });
    effect(() => {
      const reg = this.initial();
      if (reg) {
        this.applyRegistration(reg);
      }
    });
    effect(() => {
      const stay = this.initialStay();
      if (stay) {
        this.form.patchValue(stay);
      }
    });
    this.resetDates();
    const c = this.form.controls;
    merge(c.lastName.valueChanges, c.firstName.valueChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() =>
        this.displayName.set(`${c.lastName.value.trim()} ${c.firstName.value.trim()}`.trim()),
      );
  }

  /** Текущие данные проживания (для нового таба). */
  stay(): RegStay {
    const v = this.form.getRawValue();
    return { room: v.room, checkin: v.checkin, checkout: v.checkout, purpose: v.purpose };
  }

  protected invalid(name: RequiredField): boolean {
    return this.tried() && this.form.controls[name].invalid;
  }

  protected setForeign(foreign: boolean): void {
    this.foreign.set(foreign);
    const c = this.form.controls;
    if (foreign) {
      c.docType.setValue('foreign_passport');
      if (c.country.value === 'UZ') {
        c.country.setValue('GB');
      }
    } else {
      c.docType.setValue('bio_passport');
      c.country.setValue('UZ');
    }
  }

  /** Серия и номер: заглавные буквы и пробел после двух букв серии («ab1234567» → «AB 1234567»). */
  protected toUpper(): void {
    const c = this.form.controls.doc;
    const v = formatDocInput(c.value);
    if (v !== c.value) {
      c.setValue(v, { emitEvent: false });
    }
  }

  /** Лупа: поиск гостя в архиве по документу и автозаполнение. */
  protected lookup(): void {
    const doc = this.form.controls.doc.value.trim();
    if (!doc) {
      this.notify.error('guests.reg.lookupEmptyTitle', 'guests.reg.lookupEmptyText');
      return;
    }
    this.searching.set(true);
    this.filled.set(false);
    this.guests.lookupByDoc(doc).subscribe({
      next: (p) => {
        this.searching.set(false);
        this.applyProfile(p);
        const banned = this.blacklist.find(p.doc);
        if (banned) {
          this.notify.error('blacklist.warnTitle', 'blacklist.foundOnLookup', {
            reason: banned.reason,
          });
        } else {
          this.notify.success('guests.reg.foundTitle', 'guests.reg.foundText', {
            name: `${p.lastName} ${p.firstName}`,
          });
        }
      },
      error: (e: unknown) => {
        this.searching.set(false);
        if (e instanceof ApiError && e.code !== 'guests.notFound') {
          this.notify.error('common.errorTitle', `errors.${e.code}`);
          return;
        }
        this.notify.error('guests.reg.notFoundTitle', 'guests.reg.notFoundText', { doc });
      },
    });
  }

  /** Проверка обязательных полей и дат, сбор данных регистрации (без отправки). */
  collect(): RegCheck {
    this.tried.set(true);
    const missing = REQUIRED.filter((k) => this.form.controls[k].invalid);
    if (missing.length) {
      return {
        ok: false,
        title: 'guests.reg.requiredTitle',
        text: 'guests.reg.requiredText',
        params: { fields: missing.length },
      };
    }
    const v = this.form.getRawValue();
    const data: GuestRegistration = {
      docType: v.docType,
      doc: v.doc.trim(),
      issuedAt: localDateToIso(v.issuedAt),
      expiresAt: localDateToIso(v.expiresAt),
      issuedBy: v.issuedBy,
      lastName: v.lastName.trim(),
      firstName: v.firstName.trim(),
      middleName: v.middleName.trim(),
      birthDate: localDateToIso(v.birthDate),
      sex: v.sex,
      country: v.country,
      nationality: v.nationality,
      phone: v.phone,
      cityFrom: v.cityFrom,
      address: v.address,
      foreign: this.foreign(),
      visaType: this.foreign() ? v.visaType : null,
      entryDate: this.foreign() ? localDateToIso(v.entryDate) : null,
      entryPoint: this.foreign() ? v.entryPoint : '',
      room: v.room,
      checkin: localDateTimeToIso(v.checkin) ?? `${this.today}T14:00`,
      checkout: localDateTimeToIso(v.checkout) ?? `${this.today}T12:00`,
      purpose: v.purpose,
      amount: v.amount ?? 0,
      payment: v.payment,
      fiscalReceipt: v.fiscalReceipt,
      sendEmehmon: this.foreign() && v.sendEmehmon,
    };
    if (data.checkout <= data.checkin) {
      return { ok: false, title: 'guests.reg.datesTitle', text: 'guests.reg.datesText' };
    }
    return { ok: true, data };
  }

  protected submit(): void {
    if (this.multi()) {
      this.submitRequest.emit();
      return;
    }
    const check = this.collect();
    if (!check.ok) {
      this.notify.error(check.title, check.text, check.params);
      return;
    }
    const data = check.data;
    this.saving.set(true);
    this.guests.register(data).subscribe({
      next: (r) => {
        this.saving.set(false);
        this.notify.success(
          'guests.reg.doneTitle',
          data.sendEmehmon ? 'guests.reg.doneTextEmehmon' : 'guests.reg.doneText',
          { name: r.name, room: r.room },
        );
        this.done.emit(r);
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

  private applyProfile(p: GuestProfile): void {
    const isForeign = p.country !== 'UZ';
    this.foreign.set(isForeign);
    this.form.patchValue({
      docType: p.docType,
      doc: p.doc,
      issuedAt: isoToLocalDate(p.issuedAt),
      expiresAt: isoToLocalDate(p.expiresAt),
      issuedBy: p.issuedBy,
      lastName: p.lastName,
      firstName: p.firstName,
      middleName: p.middleName,
      birthDate: isoToLocalDate(p.birthDate),
      sex: p.sex,
      country: p.country,
      nationality: p.nationality,
      phone: p.phone,
      cityFrom: p.cityFrom,
      address: p.address,
    });
    // Перезапуск анимации подсветки заполненных полей.
    setTimeout(() => this.filled.set(true));
    if (this.compact()) {
      this.extraOpen.set(true);
    }
  }

  /** Заполнение формы сохранённой регистрацией (изменение записи в книге). */
  private applyRegistration(r: GuestRegistration): void {
    this.foreign.set(r.foreign);
    this.form.patchValue({
      docType: r.docType,
      doc: r.doc,
      issuedAt: isoToLocalDate(r.issuedAt),
      expiresAt: isoToLocalDate(r.expiresAt),
      issuedBy: r.issuedBy,
      lastName: r.lastName,
      firstName: r.firstName,
      middleName: r.middleName,
      birthDate: isoToLocalDate(r.birthDate),
      sex: r.sex,
      country: r.country,
      nationality: r.nationality,
      phone: r.phone,
      cityFrom: r.cityFrom,
      address: r.address,
      visaType: r.visaType ?? 'visa_free',
      entryDate: isoToLocalDate(r.entryDate),
      entryPoint: r.entryPoint,
      room: r.room,
      checkin: isoToLocalDate(r.checkin),
      checkout: isoToLocalDate(r.checkout),
      purpose: r.purpose,
      amount: r.amount,
      payment: r.payment,
      fiscalReceipt: r.fiscalReceipt,
      sendEmehmon: r.sendEmehmon,
    });
  }

  private resetDates(): void {
    this.form.patchValue({
      checkin: isoToLocalDate(`${this.today}T14:00`),
      checkout: isoToLocalDate(`${addDays(this.today, 4)}T12:00`),
    });
  }
}
