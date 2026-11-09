import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Service, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { API_URL } from '../api/api';
import { LanAddress } from '../models';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/**
 * QR-коды номеров для комментариев гостей (REST API /qr).
 *
 * Ссылка в QR-коде ведёт на страницу гостя `/c/<номер>`. Если сайт открыт как localhost,
 * телефон по такой ссылке ничего не откроет, поэтому адрес берётся из Wi-Fi IP ноутбука
 * (GET /api/lan — локальный server/hotel-api.mjs, нужен только в этом случае).
 */
@Service()
export class RoomQrService {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);
  private readonly base = `${inject(API_URL)}/qr`;

  /** Номера с включённым QR-кодом. null — ещё не загружено или API недоступен. */
  readonly enabledRooms = signal<Set<string> | null>(null);
  readonly error = signal(false);

  load(): Observable<Set<string> | null> {
    return this.http.get<string[]>(this.base).pipe(
      map((list) => new Set(list)),
      tap((set) => {
        this.enabledRooms.set(set);
        this.error.set(false);
      }),
      catchError(() => {
        this.error.set(true);
        return of(null);
      }),
    );
  }

  isEnabled(room: string): boolean {
    return this.enabledRooms()?.has(room) ?? false;
  }

  /** Включить / выключить QR. `from` — прежний номер, если номер комнаты переименовали. */
  setEnabled(room: string, enabled: boolean, from?: string): Observable<unknown> {
    return this.http.put(`${this.base}/${encodeURIComponent(room)}`, { enabled, from }).pipe(
      tap(() =>
        this.enabledRooms.update((set) => {
          const next = new Set(set ?? []);
          if (from && from !== room) {
            next.delete(from);
          }
          if (enabled) {
            next.add(room);
          } else {
            next.delete(room);
          }
          return next;
        }),
      ),
    );
  }

  /** Публичная проверка со страницы гостя. */
  check(room: string): Observable<boolean> {
    return this.http
      .get<{ enabled: boolean }>(`${this.base}/${encodeURIComponent(room)}`)
      .pipe(map((r) => r.enabled));
  }

  /**
   * Варианты адреса сайта для ссылки в QR-коде.
   * Открыто по IP или домену — используем его; открыто как localhost — Wi-Fi адреса ноутбука.
   */
  origins(): Observable<string[]> {
    const loc = this.document.location;
    if (!LOCAL_HOSTS.has(loc.hostname)) {
      return of([loc.origin]);
    }
    const port = loc.port ? `:${loc.port}` : '';
    return this.http.get<{ addresses: LanAddress[] }>('/api/lan').pipe(
      map((r) => r.addresses.map((a) => `${loc.protocol}//${a.address}${port}`)),
      catchError(() => of([])),
    );
  }

  /** Сайт открыт как localhost — значит, телефон должен идти по IP. */
  isLocalhost(): boolean {
    return LOCAL_HOSTS.has(this.document.location.hostname);
  }

  feedbackUrl(origin: string, room: string): string {
    return `${origin}/c/${encodeURIComponent(room)}`;
  }
}
