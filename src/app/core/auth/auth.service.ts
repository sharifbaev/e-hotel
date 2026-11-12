import { HttpClient, HttpContext } from '@angular/common/http';
import { Service, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, finalize, map, shareReplay } from 'rxjs';
import { API_URL, SKIP_AUTH_RETRY } from '../api/api';
import {
  APP_SECTIONS,
  AppSection,
  CurrentUser,
  DEFAULT_ROLE_SECTIONS,
  SystemRoleCode,
} from '../models';

const STORAGE_KEY = 'hotelos.session';

/** Сессия: пользователь и пара JWT-токенов. */
interface Session {
  user: CurrentUser;
  accessToken: string;
  refreshToken: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface LoginResponse extends TokenPair {
  user: CurrentUser;
}

/**
 * Сессия пользователя (REST API /auth/*).
 * «Запомнить меня» — сессия в localStorage (refresh-токен 30 дней), иначе — в sessionStorage.
 * Токены подставляет и обновляет authInterceptor (core/api/api.interceptors.ts).
 */
@Service()
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly router = inject(Router);

  private readonly session = signal<Session | null>(readSession());
  private remember = readRemember();
  private refreshing: Observable<string> | null = null;

  readonly user = computed(() => this.session()?.user ?? null);
  readonly isLoggedIn = computed(() => this.session() !== null);
  readonly isAdmin = computed(() => {
    const role = this.user()?.role;
    return role === 'owner' || role === 'admin';
  });

  /** Владелец: журнал действий доступен только ему. */
  readonly isOwner = computed(() => this.user()?.role === 'owner');

  /**
   * Разделы меню, доступные пользователю: с сервера (CurrentUser.sections),
   * иначе — доступ системной роли по умолчанию. Владельцу — всё.
   */
  readonly sections = computed<AppSection[]>(() => {
    const user = this.user();
    if (!user) {
      return [];
    }
    if (user.role === 'owner') {
      return APP_SECTIONS;
    }
    if (user.sections) {
      return user.sections.filter((s) => APP_SECTIONS.includes(s));
    }
    return DEFAULT_ROLE_SECTIONS[user.role as SystemRoleCode] ?? [];
  });

  can(section: AppSection): boolean {
    return this.sections().includes(section);
  }

  /** Первый доступный раздел — куда вести после входа и при запрете. */
  homePath(): string {
    const first = APP_SECTIONS.find((s) => this.can(s));
    return first ? `/${first}` : '/more';
  }

  accessToken(): string | null {
    return this.session()?.accessToken ?? null;
  }

  canRefresh(): boolean {
    return !!this.session()?.refreshToken;
  }

  login(login: string, password: string, remember: boolean): Observable<CurrentUser> {
    return this.http
      .post<LoginResponse>(`${this.api}/auth/login`, { login: login.trim(), password, remember })
      .pipe(
        map((r) => {
          this.remember = remember;
          this.save({ user: r.user, accessToken: r.accessToken, refreshToken: r.refreshToken });
          return r.user;
        }),
      );
  }

  /** Новая пара токенов; параллельные вызовы получают одно и то же обновление. */
  refresh(): Observable<string> {
    if (!this.refreshing) {
      const refreshToken = this.session()?.refreshToken ?? '';
      this.refreshing = this.http
        .post<TokenPair>(`${this.api}/auth/refresh`, { refreshToken })
        .pipe(
          map((p) => {
            const s = this.session();
            if (s) {
              this.save({ ...s, accessToken: p.accessToken, refreshToken: p.refreshToken });
            }
            return p.accessToken;
          }),
          finalize(() => (this.refreshing = null)),
          shareReplay(1),
        );
    }
    return this.refreshing;
  }

  /** При старте приложения: обновить данные пользователя (имя, роль, название отеля). */
  loadMe(): void {
    if (!this.session()) {
      return;
    }
    this.http.get<CurrentUser>(`${this.api}/auth/me`).subscribe({
      next: (user) => {
        const s = this.session();
        if (s) {
          this.save({ ...s, user });
        }
      },
      error: () => {
        // 401 уже обработан интерцептором (выход на страницу входа), сеть — оставляем сессию
      },
    });
  }

  /** Новые название/город отеля после сохранения настроек — в шапку без перезахода. */
  patchUser(patch: Partial<CurrentUser>): void {
    const s = this.session();
    if (s) {
      this.save({ ...s, user: { ...s.user, ...patch } });
    }
  }

  /** Смена своего пароля (после сброса администратором сервер требует её при входе). */
  changePassword(oldPassword: string, newPassword: string): Observable<void> {
    return this.http
      .post<void>(`${this.api}/auth/change-password`, { oldPassword, newPassword })
      .pipe(map(() => this.patchUser({ mustChangePassword: false })));
  }

  /** Выход по кнопке: отзываем refresh-токен на сервере (ответ не ждём). */
  logout(): void {
    const s = this.session();
    if (s) {
      this.http
        .post<void>(
          `${this.api}/auth/logout`,
          { refreshToken: s.refreshToken },
          { context: new HttpContext().set(SKIP_AUTH_RETRY, true) },
        )
        .subscribe({ error: () => undefined });
    }
    this.clear();
  }

  /** Сессия истекла (refresh не удался) — на страницу входа. */
  expire(): void {
    if (!this.session()) {
      return;
    }
    this.clear();
    void this.router.navigate(['/login']);
  }

  private save(s: Session): void {
    this.session.set(s);
    try {
      clearStorage();
      (this.remember ? localStorage : sessionStorage).setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      // Хранилище недоступно (приватный режим) — сессия живёт до перезагрузки.
    }
  }

  private clear(): void {
    this.session.set(null);
    clearStorage();
  }
}

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
    const s = raw ? (JSON.parse(raw) as Partial<Session>) : null;
    // Сессии мок-версии (без токенов) не подходят — нужен новый вход.
    return s?.user && s.accessToken && s.refreshToken ? (s as Session) : null;
  } catch {
    return null;
  }
}

function readRemember(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === null;
  } catch {
    return true;
  }
}

function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
