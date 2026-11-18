import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_URL, localDateTime } from '../api/api';
import {
  CodeCheck,
  HotelDraft,
  HotelItem,
  Organization,
  OrganizationDraft,
  PasswordResetResult,
  PlatformAdmin,
  PlatformAdminDraft,
} from '../models';

const normOrg = (o: Organization): Organization => ({
  ...o,
  createdAt: localDateTime(o.createdAt) ?? '',
  hotels: o.hotels ?? [],
  owners: (o.owners ?? []).map((u) => ({ ...u, phone: u.phone ?? '' })),
});

const normAdmin = (a: PlatformAdmin): PlatformAdmin => ({
  ...a,
  lastLogin: localDateTime(a.lastLogin ?? null),
});

/**
 * Платформа (v1.6, REST API /platform/*): только супер-админ (v1.7: тот же адрес, user.platformAdmin).
 * Владельцы (организации), их отели и аккаунты, супер-админы. X-Hotel-Id не нужен.
 */
@Service()
export class PlatformService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_URL)}/platform`;

  organizations(): Observable<Organization[]> {
    return this.http
      .get<Organization[]>(`${this.base}/organizations`)
      .pipe(map((l) => l.map(normOrg)));
  }

  organization(id: number): Observable<Organization> {
    return this.http.get<Organization>(`${this.base}/organizations/${id}`).pipe(map(normOrg));
  }

  createOrganization(draft: OrganizationDraft): Observable<Organization> {
    return this.http.post<Organization>(`${this.base}/organizations`, draft).pipe(map(normOrg));
  }

  /** v1.7: свободен ли код владельца (форма «Новый владелец»). Ничего не создаёт. */
  checkCode(code: string): Observable<CodeCheck> {
    return this.http.get<CodeCheck>(`${this.base}/organizations/code-check`, { params: { code } });
  }

  /** Только название; code не меняется. */
  renameOrganization(id: number, name: string): Observable<Organization> {
    return this.http
      .put<Organization>(`${this.base}/organizations/${id}`, { name })
      .pipe(map(normOrg));
  }

  setOrganizationActive(id: number, active: boolean): Observable<Organization> {
    return this.http
      .patch<Organization>(`${this.base}/organizations/${id}/active`, { active })
      .pipe(map(normOrg));
  }

  addHotel(orgId: number, draft: HotelDraft): Observable<HotelItem> {
    return this.http.post<HotelItem>(`${this.base}/organizations/${orgId}/hotels`, draft);
  }

  updateHotel(id: number, draft: HotelDraft): Observable<HotelItem> {
    return this.http.put<HotelItem>(`${this.base}/hotels/${id}`, draft);
  }

  setHotelActive(id: number, active: boolean): Observable<HotelItem> {
    return this.http.patch<HotelItem>(`${this.base}/hotels/${id}/active`, { active });
  }

  /** Новый пароль владельца (или любого сотрудника) — показывается один раз. */
  resetPassword(userId: number): Observable<PasswordResetResult> {
    return this.http
      .post<PasswordResetResult | null>(`${this.base}/users/${userId}/reset-password`, null)
      .pipe(map((r) => r ?? {}));
  }

  admins(): Observable<PlatformAdmin[]> {
    return this.http.get<PlatformAdmin[]>(`${this.base}/admins`).pipe(map((l) => l.map(normAdmin)));
  }

  createAdmin(draft: PlatformAdminDraft): Observable<PlatformAdmin> {
    return this.http.post<PlatformAdmin>(`${this.base}/admins`, draft).pipe(map(normAdmin));
  }

  setAdminActive(id: number, active: boolean): Observable<PlatformAdmin> {
    return this.http
      .patch<PlatformAdmin>(`${this.base}/admins/${id}/active`, { active })
      .pipe(map(normAdmin));
  }
}

/** Случайный пароль из 10 символов без похожих букв (l/1, O/0). */
export function generatePassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint32Array(10);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars.charAt(b % chars.length)).join('');
}
