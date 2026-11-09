/** Доменные модели HotelOS. Формы данных совпадают с будущим REST API. */

import type { FiscalReceiptData } from '../docs/fiscal-receipt-doc';

export type Lang = 'ru' | 'uz-Latn' | 'uz-Cyrl';

export type RoleCode = 'owner' | 'admin' | 'reception' | 'housekeeper' | 'accountant';

export type RoomStatus = 'free' | 'busy' | 'clean' | 'repair';

export type PaymentStatus = 'paid' | 'part' | 'wait';

/** Дата в формате ISO `YYYY-MM-DD`. */
export type IsoDate = string;

/** Дата и время в формате ISO `YYYY-MM-DDTHH:mm` или `YYYY-MM-DDTHH:mm:ss`. */
export type IsoDateTime = string;

export interface CurrentUser {
  id: number;
  name: string;
  login: string;
  role: RoleCode;
  hotelName: string;
  hotelCity: string;
  /** true — пароль сброшен администратором, сервер ждёт смены пароля. */
  mustChangePassword?: boolean;
}

export interface RoomCategory {
  id: number;
  name: string;
  rooms: number;
  beds: string;
  price: number;
}

export interface RoomGuest {
  name: string;
  /** Код страны ISO 3166-1 alpha-2 (UZ, RU, GB…). */
  country: string;
  doc: string;
  phone: string;
  checkin: IsoDateTime;
  checkout: IsoDateTime;
  sum: number;
  pay: PaymentStatus;
}

export interface Room {
  number: string;
  floor: number;
  category: string;
  beds: number;
  status: RoomStatus;
  /** Короткая подсказка на карточке: «Выезд 30 окт», «Уборка: Гулнора». */
  note: string;
  /** Все гости, проживающие в номере (пусто — номер не занят). */
  guests: RoomGuest[];
}

export interface NewRoom {
  number: string;
  floor: number;
  category: string;
  beds: number;
  price: number | null;
}

export type Sex = 'male' | 'female';

export interface ArchivedGuest {
  id: number;
  lastName: string;
  firstName: string;
  middleName: string;
  doc: string;
  /** Код страны ISO 3166-1 alpha-2 (UZ, RU, GB…). */
  country: string;
  room: string;
  /** Дата и время заезда / выезда. */
  checkin: IsoDateTime;
  checkout: IsoDateTime;
  sum: number;
  birthDate: IsoDate;
  sex: Sex;
  phone: string;
  /** Сохранённый фискальный чек гостя (кнопка «Фискальный чек» в архиве); нет — не выдавался. */
  receipt?: FiscalReceiptData | null;
}

/** Полные данные гостя для автозаполнения формы регистрации по документу. */
export interface GuestProfile {
  docType: DocType;
  doc: string;
  issuedAt: IsoDate | null;
  expiresAt: IsoDate | null;
  issuedBy: string;
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: IsoDate | null;
  sex: Sex;
  /** Код страны ISO 3166-1 alpha-2 (UZ, RU, GB…). */
  country: string;
  nationality: string;
  phone: string;
  cityFrom: string;
  address: string;
}

export type DocType = 'bio_passport' | 'id_card' | 'foreign_passport';
export type VisitPurpose = 'tourism' | 'business' | 'private';
export type PaymentMethod = 'cash' | 'uzcard' | 'visa' | 'transfer' | 'unpaid';
export type VisaType = 'visa_free' | 'tourist' | 'business';

export interface GuestRegistration extends GuestProfile {
  foreign: boolean;
  visaType: VisaType | null;
  entryDate: IsoDate | null;
  entryPoint: string;
  room: string;
  checkin: IsoDateTime;
  checkout: IsoDateTime;
  purpose: VisitPurpose;
  amount: number;
  payment: PaymentMethod;
  fiscalReceipt: boolean;
  sendEmehmon: boolean;
}

/** Запись «Книги гостей» — заселённый гость (после выезда уходит в архив). */
export interface BookEntry {
  id: number;
  reg: GuestRegistration;
  /** Фискальный чек, сохранённый при заселении (галочка «Сохранить фискальный чек»). */
  receipt?: FiscalReceiptData | null;
}

/** Гость в чёрном списке. Сверка — по серии и номеру документа. */
export interface BlacklistEntry {
  id: number;
  doc: string;
  lastName: string;
  firstName: string;
  middleName: string;
  /** Код страны ISO 3166-1 alpha-2. */
  country: string;
  reason: string;
  addedAt: IsoDateTime;
  addedBy: string;
}

export type BlacklistDraft = Omit<BlacklistEntry, 'id' | 'addedAt' | 'addedBy'>;

/** Итог выселения: сумма, фискальный чек и (необязательно) чёрный список. */
export interface CheckoutOptions {
  amount: number;
  /** Номер сформированного фискального чека, null — чек не выдавался. */
  receipt: string | null;
  /** Данные чека, сформированного при выселении, — сохраняются в архив первому выезжающему. */
  receiptData?: FiscalReceiptData | null;
  /** Причина для чёрного списка, null — не добавлять. */
  blacklistReason: string | null;
}

export interface Expense {
  id: number;
  reason: string;
  sum: number;
  /** Дата и время записи (с секундами). */
  date: IsoDateTime;
  who: string;
  /** Только для «Дополнительных сервисов»: вид услуги (для 'other' текст — в reason). */
  serviceType?: ServiceType;
  /** Только для «Долгов»: ФИО должника. */
  debtor?: string;
}

export type ExpenseDraft = Omit<Expense, 'id'>;

/** Вкладки меню «Платежи и расходы» — у всех одна структура записи (Expense). */
export type LedgerKind = 'expense' | 'service' | 'debt';

/** Виды дополнительных сервисов; подписи — в i18n (serviceTypes.*). */
export type ServiceType = 'breakfast' | 'pool_sauna' | 'photo' | 'other';

export const SERVICE_TYPES: ServiceType[] = ['breakfast', 'pool_sauna', 'photo', 'other'];

export interface StaffUser {
  id: number;
  name: string;
  login: string;
  role: RoleCode;
  phone: string;
  active: boolean;
  /** ISO время последнего входа; null — ещё не входил. */
  lastLogin: IsoDateTime | null;
  online: boolean;
}

export interface StaffUserDraft {
  name: string;
  login: string;
  role: RoleCode;
  phone: string;
  active: boolean;
  password?: string;
}

/** 2 — полный доступ, 1 — только просмотр, 0 — нет доступа. */
export type AccessLevel = 0 | 1 | 2;

export interface PermissionRow {
  section: string;
  access: Record<RoleCode, AccessLevel>;
}

/** Ответ POST /users/:id/reset-password: пока нет SMS, сервер возвращает временный пароль. */
export interface PasswordResetResult {
  temporaryPassword?: string;
}

export interface HotelSettings {
  name: string;
  legalName: string;
  inn: string;
  phone: string;
  address: string;
  /** Город отеля (показывается в шапке рядом с названием — CurrentUser.hotelCity). */
  city: string;
  checkinTime: string;
  checkoutTime: string;
  defaultLang: Lang;
  currency: string;
}

export type LogAction =
  'checkin' | 'checkout' | 'ready' | 'bookingEdit' | 'tariffEdit' | 'expense' | 'block';

export interface ActionLogEntry {
  id: number;
  at: IsoDateTime;
  who: string;
  action: LogAction;
  /** Параметры для текста события, текст собирается через Transloco. */
  params: Record<string, string>;
}

export type DashboardMode = 'week' | 'month' | 'period';

export interface DailyFinance {
  date: IsoDate;
  revenue: number;
  expenses: number;
}

export interface Arrival {
  guest: string;
  room: string;
  category: string;
  from: IsoDate;
  to: IsoDate;
  sum: number;
  pay: PaymentStatus;
}

export interface DashboardSummary {
  occupancy: number;
  occupancyDelta: number;
  arrivalsToday: number;
  arrivalsWaitingPayment: number;
  departuresToday: number;
  lateCheckouts: number;
  daily: DailyFinance[];
  fund: Record<RoomStatus, number>;
  totalRooms: number;
  categories: { name: string; rooms: number; occupancy: number }[];
  arrivals: Arrival[];
}

export type CommentStatus = 'new' | 'read';

/** Комментарий гостя, оставленный по QR-коду в номере. */
export interface GuestComment {
  id: number;
  at: IsoDateTime;
  room: string;
  /** Имя гостя — необязательно, пустая строка = аноним. */
  guest: string;
  /** Оценка 1–5. */
  rating: number;
  text: string;
  status: CommentStatus;
}

export interface CommentDraft {
  room: string;
  rating: number;
  text: string;
  guest: string;
}

/** Сетевой адрес ноутбука в Wi-Fi сети (для ссылки в QR-коде). */
export interface LanAddress {
  name: string;
  address: string;
}
