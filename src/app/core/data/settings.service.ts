import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable, catchError, map, of, shareReplay, tap } from 'rxjs';
import { API_URL, localDateTime } from '../api/api';
import { AuthService } from '../auth/auth.service';
import { ActionLogEntry, HotelSettings, RoomCategory } from '../models';

/** Шапка фискального чека. */
export interface ReceiptHeader {
  /** Юридическое лицо: «ЧП «BEST HOUSE SERVICES»». */
  org: string;
  /** Строка с названием: «Hotel “AVESTO”». */
  hotel: string;
}

/** Строка юр. лица в чеке, как в старом бланке: «Orbita Invest» → «ЧП «Orbita Invest»». Уже с кавычками — как есть. */
export function orgLine(legalName: string): string {
  const n = legalName.trim();
  if (!n) {
    return '';
  }
  return /[«"“]/.test(n) ? n : `ЧП «${n}»`;
}

/** Строка названия в чеке, как в старом бланке: «Niyat» → «Hotel “Niyat”». Уже с кавычками — как есть. */
export function hotelLine(name: string): string {
  const n = name.trim();
  if (!n) {
    return '';
  }
  return /[«"“]/.test(n) ? n : `Hotel “${n}”`;
}

const normHotel = (h: HotelSettings): HotelSettings => ({
  ...h,
  name: h.name ?? '',
  legalName: h.legalName ?? '',
  inn: h.inn ?? '',
  phone: h.phone ?? '',
  address: h.address ?? '',
  city: h.city ?? '',
  currency: h.currency ?? 'UZS',
});

/** Настройки отеля, категории/тарифы и журнал действий (REST API /settings, /categories, /audit-log, /audit-log/authors). */
@Service()
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly auth = inject(AuthService);
  private header$: Observable<ReceiptHeader> | null = null;

  /**
   * Шапка чека из «Настройки → Отель» (юр. лицо и название), один запрос на сессию.
   * GET /settings/hotel доступен всем ролям (v1.3); при ошибке — название из профиля.
   */
  receiptHeader(): Observable<ReceiptHeader> {
    this.header$ ??= this.getHotel().pipe(
      map((h) => ({ org: orgLine(h.legalName), hotel: hotelLine(h.name) })),
      catchError(() => {
        this.header$ = null;
        return of({ org: '', hotel: hotelLine(this.auth.user()?.hotelName ?? '') });
      }),
      shareReplay(1),
    );
    return this.header$;
  }

  getHotel(): Observable<HotelSettings> {
    return this.http.get<HotelSettings>(`${this.api}/settings/hotel`).pipe(map(normHotel));
  }

  /** После сохранения название и город сразу обновляются в шапке. */
  saveHotel(data: HotelSettings): Observable<HotelSettings> {
    return this.http.put<HotelSettings>(`${this.api}/settings/hotel`, data).pipe(
      map(normHotel),
      tap((h) => {
        this.auth.patchUser({ hotelName: h.name, hotelCity: h.city });
        this.header$ = null;
      }),
    );
  }

  listCategories(): Observable<RoomCategory[]> {
    return this.http.get<RoomCategory[]>(`${this.api}/categories`);
  }

  /** rooms считает сервер — в запрос не входит. */
  saveCategory(data: Omit<RoomCategory, 'id'>, id: number | null): Observable<RoomCategory> {
    const body = { name: data.name.trim(), beds: data.beds, price: data.price };
    return id === null
      ? this.http.post<RoomCategory>(`${this.api}/categories`, body)
      : this.http.put<RoomCategory>(`${this.api}/categories/${id}`, body);
  }

  removeCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/categories/${id}`);
  }

  /** Весь журнал (новые сверху); фильтры по сотруднику, действию и периоду — в таблице. */
  log(): Observable<ActionLogEntry[]> {
    return this.http
      .get<ActionLogEntry[]>(`${this.api}/audit-log`)
      .pipe(
        map((list) =>
          list.map((l) => ({
            ...l,
            at: localDateTime(l.at),
            params: l.params ?? {},
            changes: l.changes ?? [],
          })),
        ),
      );
  }

  /** Авторы записей журнала (в том числе удалённые сотрудники) — для фильтра «Сотрудник». */
  logAuthors(): Observable<string[]> {
    return this.http.get<string[]>(`${this.api}/audit-log/authors`);
  }
}
