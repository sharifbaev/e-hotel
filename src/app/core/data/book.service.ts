import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable, concatMap, from, map, of, tap, toArray } from 'rxjs';
import { API_URL, localDateTime } from '../api/api';
import { APP_TODAY } from '../api/mock-api';
import { FiscalReceiptData, buildStayReceipt } from '../docs/fiscal-receipt-doc';
import { BookEntry, CheckoutOptions, GuestRegistration, Room, RoomGuest } from '../models';
import { BlacklistService } from './blacklist.service';
import { RoomsService, normRoom } from './rooms.service';
import { StaffService } from './staff.service';

/** Данные проживающего для карточки номера. */
export function toRoomGuest(reg: GuestRegistration): RoomGuest {
  return {
    name: `${reg.lastName} ${reg.firstName}`.trim(),
    country: reg.country,
    doc: reg.doc,
    phone: reg.phone,
    checkin: reg.checkin,
    checkout: reg.checkout,
    sum: reg.amount,
    pay: reg.payment === 'unpaid' ? 'wait' : 'paid',
  };
}

/** Ответ POST /fiscal/receipts. */
export interface ReceiptResponse {
  number: string;
  room: string;
  amount: number;
  createdAt?: string;
}

const normEntry = (e: BookEntry): BookEntry => ({
  ...e,
  receipt: e.receipt ?? null,
  reg: { ...e.reg, checkin: localDateTime(e.reg.checkin), checkout: localDateTime(e.reg.checkout) },
});

/** Регистрация + бланк чека при заселении (v1.1; сервер v1.0 лишнее поле игнорирует). */
type RegistrationWithReceipt = GuestRegistration & { receipt: FiscalReceiptData | null };

/**
 * Книга гостей: все заселённые гости отеля (REST API /book).
 * Регистрация сразу заселяет в номер, выселение уводит гостей в архив —
 * номер, архив и чёрный список сервер обновляет сам.
 */
@Service()
export class BookService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly today = inject(APP_TODAY);
  private readonly rooms = inject(RoomsService);
  private readonly blacklist = inject(BlacklistService);
  private readonly staff = inject(StaffService);

  list(): Observable<BookEntry[]> {
    return this.http.get<BookEntry[]>(`${this.api}/book`).pipe(map((list) => list.map(normEntry)));
  }

  /**
   * Регистрация с заселением (1–10 гостей, атомарно).
   * confirmBlacklisted — администратор подтвердил заселение гостя из чёрного списка.
   * Галочка «Сохранить фискальный чек» — сначала номер чека (POST /fiscal/receipts), затем бланк в записи.
   */
  register(list: GuestRegistration[], confirmBlacklisted = false): Observable<BookEntry[]> {
    return from(list).pipe(
      concatMap((reg) => this.withReceipt(reg)),
      toArray(),
      concatMap((registrations) =>
        this.http.post<BookEntry[]>(`${this.api}/book`, { registrations, confirmBlacklisted }),
      ),
      map((created) => created.map(normEntry)),
    );
  }

  /** Изменение данных гостя (переселение в другой номер — тоже здесь). */
  update(id: number, reg: GuestRegistration, hasReceipt = false): Observable<BookEntry> {
    const body$ = hasReceipt ? of({ ...reg, receipt: null }) : this.withReceipt(reg);
    return body$.pipe(
      concatMap((body) => this.http.put<BookEntry>(`${this.api}/book/${id}`, body)),
      map(normEntry),
    );
  }

  /** Номер фискального чека на итоговую сумму. */
  fiscalReceipt(room: string, amount: number, docs: string[] = []): Observable<ReceiptResponse> {
    return this.http.post<ReceiptResponse>(`${this.api}/fiscal/receipts`, { room, amount, docs });
  }

  /**
   * Выселение (закрытие клиента): гости уходят из номера и книги в архив,
   * при необходимости — в чёрный список. Итоговая сумма записывается первому выезжающему.
   */
  checkout(room: string, docs: string[], opts: CheckoutOptions): Observable<Room> {
    return this.http
      .post<Room>(`${this.api}/rooms/${encodeURIComponent(room)}/checkout`, {
        docs,
        amount: opts.amount,
        receipt: opts.receipt,
        receiptData: opts.receiptData ?? null,
        blacklistReason: opts.blacklistReason,
      })
      .pipe(
        map(normRoom),
        tap(() => {
          if (opts.blacklistReason) {
            this.blacklist.reload();
          }
        }),
      );
  }

  /** Галочка чека и сумма > 0 — получаем номер чека и собираем бланк на проживание. */
  private withReceipt(reg: GuestRegistration): Observable<RegistrationWithReceipt> {
    if (!reg.fiscalReceipt || !(reg.amount > 0)) {
      return of({ ...reg, receipt: null });
    }
    return this.fiscalReceipt(reg.room, reg.amount, [reg.doc]).pipe(
      map((r) => ({
        ...reg,
        receipt: buildStayReceipt({
          number: r.number,
          date: this.today,
          guest: `${reg.lastName} ${reg.firstName}`.trim(),
          room: reg.room,
          category: this.rooms.categoryOf(reg.room),
          checkin: reg.checkin,
          checkout: reg.checkout,
          amount: reg.amount,
          cashier: this.staff.myName(),
        }),
      })),
    );
  }
}
