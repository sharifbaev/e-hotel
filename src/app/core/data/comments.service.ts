import { HttpClient } from '@angular/common/http';
import { DestroyRef, Service, computed, inject, signal } from '@angular/core';
import { Observable, Subscription, catchError, map, of, tap, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { API_URL, localDateTime } from '../api/api';
import { CommentDraft, CommentStatus, GuestComment } from '../models';

const norm = (c: GuestComment): GuestComment => ({
  ...c,
  at: localDateTime(c.at),
  guest: c.guest ?? '',
  text: c.text ?? '',
});

/** Как часто перечитывать список, чтобы новый комментарий с телефона появился сам (мс). */
const POLL_MS = 10_000;

/**
 * Комментарии гостей (REST API /comments). Комментарий пишется с телефона гостя
 * (публичный POST /comments) и появляется у сотрудников при следующем опросе.
 *
 * Сервис держит общий список: бейдж «новых» в меню и экран «Комментарии» видят одни данные.
 */
@Service()
export class CommentsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_URL)}/comments`;

  private readonly _items = signal<GuestComment[] | null>(null);
  private readonly _error = signal(false);
  private poll: Subscription | null = null;
  private watchers = 0;

  /** null — ещё не загружено. */
  readonly items = this._items.asReadonly();
  /** API недоступен (нет связи с сервером). */
  readonly error = this._error.asReadonly();
  readonly loaded = computed(() => this._items() !== null || this._error());
  readonly newCount = computed(
    () => (this._items() ?? []).filter((c) => c.status === 'new').length,
  );

  /**
   * Подписаться на автообновление. Пока есть хотя бы один подписчик
   * (каркас приложения, экран комментариев), список перечитывается каждые 10 секунд.
   */
  watch(destroyRef: DestroyRef): void {
    this.watchers++;
    if (!this.poll) {
      this.poll = timer(0, POLL_MS)
        .pipe(switchMap(() => this.fetch()))
        .subscribe();
    }
    destroyRef.onDestroy(() => {
      this.watchers--;
      if (this.watchers === 0) {
        this.poll?.unsubscribe();
        this.poll = null;
      }
    });
  }

  /** Перечитать сейчас (кнопка «Обновить»). */
  refresh(): Observable<GuestComment[] | null> {
    return this.fetch();
  }

  /** Публичный: отправка со страницы гостя. */
  create(draft: CommentDraft): Observable<GuestComment> {
    return this.http.post<GuestComment>(this.base, draft).pipe(map(norm));
  }

  setStatus(id: number, status: CommentStatus): Observable<GuestComment> {
    this.patchLocal((list) => list.map((c) => (c.id === id ? { ...c, status } : c)));
    return this.http.patch<GuestComment>(`${this.base}/${id}`, { status }).pipe(map(norm));
  }

  readAll(): Observable<unknown> {
    this.patchLocal((list) => list.map((c) => ({ ...c, status: 'read' as const })));
    return this.http.post(`${this.base}/read-all`, null);
  }

  remove(id: number): Observable<unknown> {
    this.patchLocal((list) => list.filter((c) => c.id !== id));
    return this.http.delete(`${this.base}/${id}`);
  }

  private fetch(): Observable<GuestComment[] | null> {
    return this.http.get<GuestComment[]>(this.base).pipe(
      map((list) => list.map(norm)),
      tap((list) => {
        this._items.set(list);
        this._error.set(false);
      }),
      catchError(() => {
        this._error.set(true);
        return of(null);
      }),
    );
  }

  private patchLocal(fn: (list: GuestComment[]) => GuestComment[]): void {
    this._items.update((list) => (list ? fn(list) : list));
  }
}
