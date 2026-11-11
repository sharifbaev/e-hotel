import { HttpClient } from '@angular/common/http';
import { Service, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { API_URL } from '../api/api';
import { APP_SECTIONS, DEFAULT_ROLE_SECTIONS, Role, RoleDraft, SystemRoleCode } from '../models';

/** Системные роли — пока сервер не отдаёт /roles, формы работают с ними. */
const FALLBACK_ROLES: Role[] = (['owner', 'admin', 'accountant'] as SystemRoleCode[]).map(
  (code, i) => ({
    id: -(i + 1),
    code,
    name: code,
    system: true,
    sections: [...DEFAULT_ROLE_SECTIONS[code]],
  }),
);

const norm = (r: Role): Role => ({
  ...r,
  name: r.name ?? '',
  system: !!r.system,
  // У владельца — всегда все разделы; неизвестные разделы отбрасываем.
  sections:
    r.code === 'owner'
      ? [...APP_SECTIONS]
      : (r.sections ?? []).filter((s) => APP_SECTIONS.includes(s)),
});

/**
 * Роли сотрудников (REST API /roles): список для селектов и CRUD в «Настройки → Справочники».
 * Системные роли owner / admin / accountant сервер создаёт сам, удалить их нельзя.
 */
@Service()
export class RolesService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);

  private readonly _roles = signal<Role[]>(FALLBACK_ROLES);
  private loaded = false;

  /** Последний загруженный список (до загрузки — системные роли). */
  readonly roles = this._roles.asReadonly();
  readonly byCode = computed(() => new Map(this._roles().map((r) => [r.code, r])));

  /** Список ролей; если API ещё нет (404) — системные роли. */
  list(): Observable<Role[]> {
    return this.http.get<Role[]>(`${this.api}/roles`).pipe(
      map((list) => list.map(norm)),
      catchError(() => of(FALLBACK_ROLES)),
      tap((list) => {
        this.loaded = true;
        this._roles.set(list);
      }),
    );
  }

  /** Загрузить один раз (для подписей ролей в таблицах). */
  load(): void {
    if (!this.loaded) {
      this.list().subscribe();
    }
  }

  create(draft: RoleDraft): Observable<Role> {
    return this.http.post<Role>(`${this.api}/roles`, body(draft)).pipe(
      map(norm),
      tap((r) => this._roles.update((l) => [...l, r])),
    );
  }

  update(id: number, draft: RoleDraft): Observable<Role> {
    return this.http.put<Role>(`${this.api}/roles/${id}`, body(draft)).pipe(
      map(norm),
      tap((r) => this._roles.update((l) => l.map((x) => (x.id === id ? r : x)))),
    );
  }

  remove(id: number): Observable<void> {
    return this.http
      .delete<void>(`${this.api}/roles/${id}`)
      .pipe(tap(() => this._roles.update((l) => l.filter((x) => x.id !== id))));
  }
}

const body = (d: RoleDraft) => ({ name: d.name.trim(), sections: d.sections });
