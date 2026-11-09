import { HttpClient } from '@angular/common/http';
import { Service, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { API_URL, localDateTime } from '../api/api';
import { AuthService } from '../auth/auth.service';
import { BlacklistDraft, BlacklistEntry } from '../models';

/** Нормализация документа для сверки: без пробелов, в верхнем регистре. */
export const normalizeDoc = (doc: string) => doc.replace(/\s+/g, '').toUpperCase();

const norm = (e: BlacklistEntry): BlacklistEntry => ({ ...e, addedAt: localDateTime(e.addedAt) });

/**
 * Чёрный список гостей (REST API /blacklist).
 * Список держится в памяти — для мгновенной проверки документа в формах и таблицах (find).
 * Окончательную проверку при заселении делает сервер (409 blacklist.found).
 */
@Service()
export class BlacklistService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly entries = signal<BlacklistEntry[]>([]);

  constructor() {
    if (inject(AuthService).isLoggedIn()) {
      this.reload();
    }
  }

  list(): Observable<BlacklistEntry[]> {
    return this.http.get<BlacklistEntry[]>(`${this.api}/blacklist`).pipe(
      map((list) => list.map(norm)),
      tap((list) => this.entries.set(list)),
    );
  }

  /** Обновить список в памяти (после выселения с добавлением в чёрный список). */
  reload(): void {
    this.list().subscribe({ error: () => undefined });
  }

  /** Мгновенная проверка документа (при регистрации и заселении) по загруженному списку. */
  find(doc: string): BlacklistEntry | null {
    const q = normalizeDoc(doc);
    return q ? (this.entries().find((e) => normalizeDoc(e.doc) === q) ?? null) : null;
  }

  add(draft: BlacklistDraft): Observable<BlacklistEntry> {
    return this.http.post<BlacklistEntry>(`${this.api}/blacklist`, draft).pipe(
      map(norm),
      tap((e) => this.entries.update((list) => [e, ...list])),
    );
  }

  remove(id: number): Observable<void> {
    return this.http
      .delete<void>(`${this.api}/blacklist/${id}`)
      .pipe(tap(() => this.entries.update((list) => list.filter((e) => e.id !== id))));
  }
}
