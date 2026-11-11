import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { API_URL, localDateTime } from '../api/api';
import { NewRoom, Room } from '../models';

/** Ответ /rooms: даты гостей — в местном формате «YYYY-MM-DDTHH:mm[:ss]». */
export function normRoom(r: Room): Room {
  return {
    ...r,
    note: r.note ?? '',
    guests: (r.guests ?? []).map((g) => ({
      ...g,
      checkin: localDateTime(g.checkin),
      checkout: localDateTime(g.checkout),
    })),
  };
}

const enc = encodeURIComponent;

/**
 * Номерной фонд (REST API /rooms).
 * Заселение и выселение меняют номер на сервере: POST /book, POST /rooms/:n/checkout (BookService).
 */
@Service()
export class RoomsService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);

  /** Последний загруженный список — для категории номера в фискальном чеке. */
  private known = new Map<string, Room>();

  list(): Observable<Room[]> {
    return this.http.get<Room[]>(`${this.api}/rooms`).pipe(
      map((list) => list.map(normRoom)),
      tap((list) => this.remember(list)),
    );
  }

  /** Категория номера (для строки фискального чека). */
  categoryOf(number: string): string {
    return this.known.get(number)?.category ?? '';
  }

  /** Номера, в которые можно заселить (свободные). */
  freeRooms(): Observable<Room[]> {
    return this.list().pipe(map((list) => list.filter((r) => r.status === 'free')));
  }

  /** Номера для заселения: свободные и занятые, где ещё есть места (GET /rooms/available). */
  checkInRooms(): Observable<Room[]> {
    return this.http.get<Room[]>(`${this.api}/rooms/available`).pipe(
      map((list) => list.map(normRoom)),
      tap((list) => this.remember(list)),
    );
  }

  add(data: NewRoom): Observable<Room> {
    return this.http
      .post<Room>(`${this.api}/rooms`, { ...data, number: data.number.trim() })
      .pipe(map(normRoom));
  }

  /** Изменение номера (номер комнаты, этаж, категория, мест). Гости и статус сохраняются. */
  update(number: string, data: NewRoom): Observable<Room> {
    return this.http
      .put<Room>(`${this.api}/rooms/${enc(number)}`, { ...data, number: data.number.trim() })
      .pipe(map(normRoom));
  }

  /** Удаление номера (только без проживающих гостей; сервер проверяет сам). */
  remove(number: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/rooms/${enc(number)}`);
  }

  /** Продление проживания: новая дата и время выезда (для всех гостей номера). */
  extend(number: string, checkout: string): Observable<Room> {
    return this.http
      .post<Room>(`${this.api}/rooms/${enc(number)}/extend`, { checkout })
      .pipe(map(normRoom));
  }

  /** Номер готов после уборки/ремонта. */
  markReady(number: string): Observable<Room> {
    return this.http.post<Room>(`${this.api}/rooms/${enc(number)}/ready`, null).pipe(map(normRoom));
  }

  private remember(list: Room[]): void {
    for (const r of list) {
      this.known.set(r.number, r);
    }
  }
}
