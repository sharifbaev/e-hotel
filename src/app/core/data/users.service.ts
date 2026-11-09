import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_URL, localDateTime } from '../api/api';
import { PasswordResetResult, PermissionRow, StaffUser, StaffUserDraft } from '../models';

const norm = (u: StaffUser): StaffUser => ({
  ...u,
  phone: u.phone ?? '',
  lastLogin: localDateTime(u.lastLogin ?? null),
  online: !!u.online,
});

/** Сотрудники и роли (REST API /users, /roles/permissions). Только владелец и администратор. */
@Service()
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);

  list(): Observable<StaffUser[]> {
    return this.http.get<StaffUser[]>(`${this.api}/users`).pipe(map((list) => list.map(norm)));
  }

  permissions(): Observable<PermissionRow[]> {
    return this.http.get<PermissionRow[]>(`${this.api}/roles/permissions`);
  }

  create(draft: StaffUserDraft): Observable<StaffUser> {
    return this.http.post<StaffUser>(`${this.api}/users`, draft).pipe(map(norm));
  }

  /** password — только если задан новый. */
  update(id: number, draft: StaffUserDraft): Observable<StaffUser> {
    return this.http.put<StaffUser>(`${this.api}/users/${id}`, draft).pipe(map(norm));
  }

  setActive(id: number, active: boolean): Observable<StaffUser> {
    return this.http.patch<StaffUser>(`${this.api}/users/${id}/active`, { active }).pipe(map(norm));
  }

  /**
   * Сброс пароля. Пока нет SMS, сервер отвечает 200 { temporaryPassword };
   * после подключения SMS — 204 без тела (пароль ушёл на телефон).
   */
  resetPassword(id: number): Observable<PasswordResetResult> {
    return this.http
      .post<PasswordResetResult | null>(`${this.api}/users/${id}/reset-password`, null)
      .pipe(map((r) => r ?? {}));
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/users/${id}`);
  }
}
