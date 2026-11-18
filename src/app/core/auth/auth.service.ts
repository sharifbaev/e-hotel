import { HttpClient, HttpContext } from '@angular/common/http';
import { Service, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, finalize, map, shareReplay, tap } from 'rxjs';
import { API_URL, SKIP_AUTH_RETRY } from '../api/api';
import {
  APP_SECTIONS,
  AppSection,
  CurrentUser,
  DEFAULT_ROLE_SECTIONS,
  HotelItem,
  SystemRoleCode,
} from '../models';

const STORAGE_KEY = 'hotelos.session';
/** Выбранный в переключателе отель (v1.6). */
const HOTEL_KEY = 'hotelos.hotelId';

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
  /** Отель, выбранный в переключателе (или супер-админом при «Войти в отель»). */
  private readonly selectedHotel = signal<number | null>(readHotelId());

  readonly user = computed(() => this.session()?.user ?? null);
  readonly isLoggedIn = computed(() => this.session() !== null);
  readonly isAdmin = computed(() => {
    const role = this.user()?.role;
    return role === 'owner' || role === 'admin';
  });

  /** Отели, в которые может войти пользователь (CurrentUser.hotels). */
  readonly hotels = computed<HotelItem[]>(() => this.user()?.hotels ?? []);

  /** Супер-админ платформы (v1.7: логин platform_<имя>, тот же адрес; меню — по этому флагу). */
  readonly isPlatformAdmin = computed(() => !!this.user()?.platformAdmin);

  /**
   * Текущий отель — значение заголовка X-Hotel-Id.
   * 1) выбор в переключателе, если он есть в user.hotels и не заблокирован
   *    (супер-админу — любой выбранный: его hotels всегда []);
   * 2) иначе user.hotelId (у сотрудника с одним отелем сервер ставит его сам);
   * 3) иначе единственный отель из списка; null — отель не выбран.
   */
  readonly hotelId = computed<number | null>(() => {
    const user = this.user();
    if (!user) {
      return null;
    }
    const selected = this.selectedHotel();
    if (user.platformAdmin) {
      return selected;
    }
    const hotels = user.hotels ?? [];
    if (selected !== null && hotels.some((h) => h.id === selected && h.active)) {
      return selected;
    }
    if (user.hotelId != null) {
      return user.hotelId;
    }
    return hotels.length === 1 ? hotels[0].id : null;
  });

  /** У пользователя больше одного отеля — в шапке показывается переключатель. */
  readonly multiHotel = computed(() => this.hotels().length > 1);

  /**
   * Нужно выбрать отель: сервер ответил 422 hotel.required / 403 hotel.forbidden,
   * или после входа у сотрудника несколько отелей и ни один не выбран.
   * Окно выбора отеля (переключатель) открывается по этому сигналу.
   */
  readonly hotelRequired = signal(false);

  /** Окно «Сменить пароль» (меню пользователя; по желанию сотрудника). */
  readonly passwordDialog = signal(false);

  /** Владелец (и супер-админ в отеле): журнал действий доступен только им. */
  readonly isOwner = computed(() => this.user()?.role === 'owner' || this.isPlatformAdmin());

  /** Супер-админ на платформе (не вошёл ни в один отель): меню платформы. */
  readonly platformMode = computed(() => this.isPlatformAdmin() && this.hotelId() === null);

  /**
   * Разделы меню, доступные пользователю: с сервера (CurrentUser.sections),
   * иначе — доступ системной роли по умолчанию. Владельцу — всё.
   */
  readonly sections = computed<AppSection[]>(() => {
    const user = this.user();
    if (!user) {
      return [];
    }
    // Владельцу и супер-админу в отеле — всё; на платформе супер-админ разделов отеля не видит.
    if (user.role === 'owner' || (user.platformAdmin && this.hotelId() !== null)) {
      return APP_SECTIONS;
    }
    if (user.platformAdmin) {
      return [];
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
    if (this.platformMode()) {
      return '/platform';
    }
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
          // Супер-админ после входа — на платформе, а не в последнем отеле.
          if (r.user.platformAdmin) {
            this.selectHotel(null);
          }
          this.hotelRequired.set(
            !r.user.platformAdmin && this.hotelId() === null && this.multiHotel(),
          );
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

  /** При старте приложения: обновить данные пользователя (имя, роль, отель, список отелей). */
  loadMe(): void {
    if (!this.session()) {
      return;
    }
    this.reloadMe().subscribe({
      error: () => {
        // 401 уже обработан интерцептором (выход на страницу входа), сеть — оставляем сессию
      },
    });
  }

  /**
   * GET /auth/me (с X-Hotel-Id текущего отеля, если он есть): hotelId, hotelName,
   * разделы меню — уже для выбранного отеля.
   */
  reloadMe(): Observable<CurrentUser> {
    return this.http.get<CurrentUser>(`${this.api}/auth/me`).pipe(
      tap((user) => {
        const s = this.session();
        if (s) {
          this.save({ ...s, user });
        }
        if (!user.platformAdmin && this.hotelId() === null && (user.hotels ?? []).length > 1) {
          this.hotelRequired.set(true);
        }
      }),
    );
  }

  /** Выбрать отель (переключатель / «Войти в отель» супер-админа); выбор запоминается. */
  selectHotel(id: number | null): void {
    this.selectedHotel.set(id);
    writeHotelId(id);
    if (id !== null) {
      this.hotelRequired.set(false);
    }
  }

  /**
   * Сменить текущий отель: запомнить выбор, перечитать /auth/me (название отеля, разделы меню)
   * и открыть приложение заново с главной — так сбрасываются все данные прежнего отеля
   * (номера, книга, типы оплаты, настройки, дашборд…). `path` — куда открыть (по умолчанию «/»).
   */
  switchHotel(id: number, path = '/'): void {
    this.selectHotel(id);
    this.reloadMe().subscribe({
      complete: () => location.assign(path),
      error: () => location.assign(path),
    });
  }

  /**
   * Отель выбран и с ним можно работать. Супер-админу в отеле id нужен всегда;
   * у старой сессии (до v1.6, без hotels) — ждём ответа /auth/me.
   */
  readonly hotelReady = computed(() => {
    const user = this.user();
    if (!user) {
      return false;
    }
    if (!user.platformAdmin && !user.hotels) {
      return true;
    }
    return this.hotelId() !== null;
  });

  /** 422 hotel.required — отель не выбран: открыть окно выбора. */
  requireHotel(): void {
    if (this.session()) {
      this.hotelRequired.set(true);
    }
  }

  /**
   * 403 hotel.forbidden — выбранного отеля больше нет или сотрудника из него убрали:
   * забыть выбор, перечитать /auth/me и снова попросить выбрать отель.
   */
  hotelForbidden(): void {
    if (!this.session()) {
      return;
    }
    this.selectHotel(null);
    this.reloadMe().subscribe({ error: () => undefined });
    this.hotelRequired.set(true);
  }

  /** Новые название/город отеля после сохранения настроек — в шапку без перезахода. */
  patchUser(patch: Partial<CurrentUser>): void {
    const s = this.session();
    if (s) {
      this.save({ ...s, user: { ...s.user, ...patch } });
    }
  }

  /** Смена своего пароля — по желанию, из меню пользователя (v1.6: принудительной смены нет). */
  changePassword(oldPassword: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${this.api}/auth/change-password`, { oldPassword, newPassword });
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
    this.hotelRequired.set(false);
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

function readHotelId(): number | null {
  try {
    const v = Number(localStorage.getItem(HOTEL_KEY));
    return Number.isInteger(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

function writeHotelId(id: number | null): void {
  try {
    if (id === null) {
      localStorage.removeItem(HOTEL_KEY);
    } else {
      localStorage.setItem(HOTEL_KEY, String(id));
    }
  } catch {
    // хранилище недоступно — выбор живёт до перезагрузки
  }
}
