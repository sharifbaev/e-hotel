/** Доменные модели HotelOS. Формы данных совпадают с будущим REST API. */

import type { FiscalReceiptData } from '../docs/fiscal-receipt-doc';

export type Lang = 'ru' | 'uz-Latn' | 'uz-Cyrl';

/**
 * Код роли: owner, admin, accountant или role_<id>. v1.6: системная роль только owner;
 * admin и accountant — начальные роли, владелец может их переименовать и удалить.
 * У удалённого сотрудника удалённой роли — "".
 */
export type RoleCode = string;

/** Системные роли (подписи — в i18n roles.*). */
export type SystemRoleCode = 'owner' | 'admin' | 'accountant';

/** Разделы меню, к которым роль может иметь доступ. */
export type AppSection =
  | 'dashboard'
  | 'rooms'
  | 'book'
  | 'guests'
  | 'blacklist'
  | 'payments'
  | 'comments'
  | 'users'
  | 'settings';

export const APP_SECTIONS: AppSection[] = [
  'dashboard',
  'rooms',
  'book',
  'guests',
  'blacklist',
  'payments',
  'comments',
  'users',
  'settings',
];

/** Доступ системных ролей по умолчанию (пока сервер не прислал свои разделы). */
export const DEFAULT_ROLE_SECTIONS: Record<SystemRoleCode, AppSection[]> = {
  owner: APP_SECTIONS,
  admin: ['rooms', 'book', 'guests', 'payments', 'comments'],
  accountant: ['dashboard', 'payments'],
};

/** Роль сотрудника (REST API /roles). */
export interface Role {
  id: number;
  code: RoleCode;
  /** Название; у системных ролей в интерфейсе показывается перевод roles.<code>. */
  name: string;
  /** true — системная роль (v1.6: только owner): нельзя изменить и удалить. */
  system: boolean;
  /** Разделы меню, доступные роли. У owner — всегда все. */
  sections: AppSection[];
}

export interface RoleDraft {
  name: string;
  sections: AppSection[];
}

/** Вид дополнительного сервиса (справочник REST API /service-types). */
export interface ServiceTypeItem {
  id: number;
  name: string;
}

/**
 * Справочник «Тип оплаты» (/payment-types). code — то, что хранится у гостя в `payment`.
 * Системные (cash, uzcard, visa, transfer, unpaid) нельзя изменить и удалить,
 * их название переводится на фронте (paymentMethods.<code>); у своих — code `pt_<id>` и name.
 */
export interface PaymentTypeItem {
  id: number;
  code: string;
  name: string;
  system: boolean;
}

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
  /** Название роли (для ролей, созданных пользователем). */
  roleName?: string;
  /** Разделы меню, доступные пользователю; нет — берутся DEFAULT_ROLE_SECTIONS по коду роли. */
  sections?: AppSection[];
  /** Текущий отель (X-Hotel-Id или единственный отель сотрудника); null — не выбран. */
  hotelId: number | null;
  /** Название текущего отеля; не выбран — "". */
  hotelName: string;
  /** Город текущего отеля; не выбран — "". */
  hotelCity: string;
  /** Отели, в которые сотрудник может войти (= GET /hotels). У супер-админа — []. */
  hotels: HotelItem[];
  /** Владелец (организация); code — префикс логинов его сотрудников: grand → grand_admin (v1.7). */
  organization: OrganizationRef;
  /** true — супер-админ платформы (логин platform_<имя>, v1.7). */
  platformAdmin: boolean;
}

/** Отель (переключатель отелей, списки платформы). v1.6 */
export interface HotelItem {
  id: number;
  name: string;
  city: string;
  /** false — заблокирован супер-админом, выбрать нельзя. */
  active: boolean;
}

/** Владелец (организация). v1.6; v1.7 — code = префикс логинов. */
export interface OrganizationRef {
  code: string;
  name: string;
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
  /** Выезд ставится при выселении; у проживающего — null. */
  checkout: IsoDateTime | null;
  /** Стоимость за день. */
  sum: number;
  /** Внесённая предоплата (сумма всех предоплат); нет — 0. */
  prepayment?: number;
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
  /** Способ оплаты при выселении (код справочника), null — не указан (старые записи, не первый выезжающий). */
  checkoutPayment?: string | null;
  /** Для «Смешанный»: сколько картой и сколько наличными. */
  paidCard?: number | null;
  paidCash?: number | null;
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
/** Код типа оплаты из справочника /payment-types (системные: cash, uzcard, visa, transfer, unpaid). */
export type PaymentMethod = string;
/** Системные коды типов оплаты. */
export const SYSTEM_PAYMENTS = ['cash', 'uzcard', 'visa', 'transfer', 'mixed', 'unpaid'] as const;
/** «Смешанный»: часть картой, часть наличными (две суммы при выселении). */
export const MIXED_PAYMENT = 'mixed';
export type VisaType = 'visa_free' | 'tourist' | 'business';

export interface GuestRegistration extends GuestProfile {
  foreign: boolean;
  visaType: VisaType | null;
  entryDate: IsoDate | null;
  entryPoint: string;
  room: string;
  checkin: IsoDateTime;
  /** В форме заселения нет — фактические дата и время выезда ставятся при выселении. */
  checkout: IsoDateTime | null;
  purpose: VisitPurpose;
  /** Стоимость за день (договорная). Итог при выселении = amount × количество дней. */
  amount: number;
  /** Сумма предоплаты (всего внесено); 0 — предоплаты нет. */
  prepayment: number;
  /** Способ оплаты предоплаты; без предоплаты — unpaid. */
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

/** Оплата: «Внести предоплату» в «Книге» и «Оплатить» долг — сумма и способ оплаты. */
export interface PrepaymentDraft {
  amount: number;
  payment: PaymentMethod;
}

/** Итог выселения: сумма, фискальный чек и (необязательно) чёрный список. */
export interface CheckoutOptions {
  /** К оплате за проживание: стоимость за день × количество дней (можно изменить). */
  amount: number;
  /** Предоплата отмеченных гостей. */
  prepayment: number;
  /** «Сумма» — сколько гость оплатил при выселении. */
  paid: number;
  /** Недоплата: amount − prepayment − paid (не меньше 0); записывается в «Долги». */
  debt: number;
  /** Способ оплаты при выселении — код из справочника «Способ оплаты». */
  payment: string;
  /** Для «Смешанный» (mixed): сколько картой и сколько наличными (сумма = paid), иначе null. */
  paidCard: number | null;
  paidCash: number | null;
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
  /** Только для «Дополнительных сервисов»: вид услуги из справочника; null — «Другое» (текст — в reason). */
  serviceTypeId?: number | null;
  /** Название вида услуги (присылает сервер). */
  serviceTypeName?: string;
  /** Старый формат (до справочника): код вида услуги. */
  serviceType?: ServiceType;
  /** Только для «Долгов»: ФИО должника. */
  debtor?: string;
}

export type ExpenseDraft = Omit<Expense, 'id'>;

/** Вкладки меню «Платежи и расходы» — у всех одна структура записи (Expense). */
export type LedgerKind = 'expense' | 'service' | 'debt';

/** Старые коды видов дополнительных сервисов (до справочника /service-types); подписи — в i18n (serviceTypes.*). */
export type ServiceType = 'breakfast' | 'pool_sauna' | 'photo' | 'other';

export const SERVICE_TYPES: ServiceType[] = ['breakfast', 'pool_sauna', 'photo', 'other'];

export interface StaffUser {
  id: number;
  name: string;
  login: string;
  role: RoleCode;
  /** Название роли (для ролей, созданных пользователем). */
  roleName?: string;
  phone: string;
  active: boolean;
  /** ISO время последнего входа; null — ещё не входил. */
  lastLogin: IsoDateTime | null;
  online: boolean;
  /** Отели, где работает сотрудник; у владельца — все отели (v1.6). */
  hotelIds: number[];
}

export interface StaffUserDraft {
  name: string;
  login: string;
  role: RoleCode;
  phone: string;
  active: boolean;
  password?: string;
  /**
   * Отели сотрудника (v1.6) — только из тех, где работает сам редактор.
   * Создание: null / [] — текущий отель; изменение: null / нет поля — не меняется.
   */
  hotelIds?: number[] | null;
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

/**
 * Код действия журнала (v1.3): `<раздел>.<операция>` — guest.checkin, room.create, expense.delete, auth.login…
 * Полный список — docs/claude-code-backend-v1.3.md. Старые записи: checkin, checkout, ready, bookingEdit,
 * tariffEdit, expense, block.
 */
export type LogAction = string;

export interface ActionLogEntry {
  id: number;
  at: IsoDateTime;
  who: string;
  action: LogAction;
  /** Параметры для текста события (target, room, sum…), текст собирается через Transloco. */
  params: Record<string, string>;
  /** Какие поля изменены (имена полей API) — для операций update. */
  changes?: string[];
  /** v1.6: отель действия; null — общее действие владельца (вход, сотрудники, роли, чёрный список). */
  hotelId?: number | null;
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
  /**
   * Откуда доход за период (v1.5): проживание гостей (предоплаты + оплата при выселении),
   * оплата долгов, дополнительные сервисы. Нет — старый сервер, доход = Σ daily.revenue.
   */
  income?: DashboardIncome | null;
}

export interface DashboardIncome {
  stay: number;
  debts: number;
  services: number;
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

// ===== v1.6: платформа (супер-админ; v1.7 — тот же адрес, вход по логину platform_<имя>) =====

/** Реквизиты отеля, которые вводит супер-админ (POST/PUT /platform/…/hotels). */
export interface HotelDraft {
  name: string;
  city: string;
  legalName: string;
  /** Пусто или 9 цифр (422 settings.innInvalid). */
  inn: string;
  phone: string;
  address: string;
}

/** Аккаунт владельца при создании владельца (организации). */
export interface OwnerDraft {
  name: string;
  login: string;
  password: string;
  phone: string;
}

/** POST /platform/organizations — владелец, его аккаунт и первый отель одной формой. */
export interface OrganizationDraft {
  /** Код владельца — префикс логинов его сотрудников (grand → grand_admin); потом не меняется. */
  code: string;
  name: string;
  owner: OwnerDraft;
  hotel: HotelDraft;
}

/** Аккаунт владельца в списках платформы. */
export interface OwnerShort {
  id: number;
  name: string;
  login: string;
  phone: string;
  active: boolean;
}

/** Владелец (организация) для платформы. */
export interface Organization {
  id: number;
  code: string;
  name: string;
  active: boolean;
  createdAt: IsoDateTime;
  hotels: HotelItem[];
  owners: OwnerShort[];
}

export interface PlatformAdmin {
  id: number;
  name: string;
  login: string;
  active: boolean;
  lastLogin: IsoDateTime | null;
}

export interface PlatformAdminDraft {
  name: string;
  login: string;
  password: string;
}

/** GET /platform/organizations/code-check — свободен ли код владельца (v1.7, только подсказка). */
export interface CodeCheck {
  /** Проверенный код, как был отправлен. */
  code: string;
  /** true — владелец с этим кодом может быть создан. */
  available: boolean;
  /** Причина, если available = false: invalid — формат/зарезервированное слово, taken — занят. */
  reason: '' | 'invalid' | 'taken';
}
