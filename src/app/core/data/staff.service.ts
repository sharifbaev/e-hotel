import { HttpClient } from '@angular/common/http';
import { Service, computed, inject, signal } from '@angular/core';
import { API_URL } from '../api/api';
import { AuthService } from '../auth/auth.service';
import { RoleCode } from '../models';

export interface StaffShort {
  id: number;
  name: string;
  role: RoleCode;
  /** false — заблокирован или удалён (приходит только с includeInactive=true). */
  active?: boolean;
}

/**
 * Краткий список сотрудников (GET /staff?includeInactive=true) — для выпадающих списков
 * «Кто оформил» (только активные) и фильтров по сотруднику (все, включая заблокированных и
 * удалённых: в старых записях есть их ФИО). Доступен любой роли, загружается один раз.
 */
@Service()
export class StaffService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly auth = inject(AuthService);
  private readonly list = signal<StaffShort[]>([]);
  private loaded = false;

  /**
   * ФИО текущего пользователя из списка сотрудников (как в «Пользователях»).
   * /auth/me может отдавать в name логин — для чека и «Кто оформил» берём ФИО отсюда.
   */
  readonly myName = computed(() => {
    const user = this.auth.user();
    return this.list().find((s) => s.id === user?.id)?.name || user?.name || '';
  });

  /** Формы: ФИО активных по алфавиту; текущий пользователь есть всегда (даже пока список грузится). */
  readonly names = computed(() => this.sorted(this.list().filter((s) => s.active !== false)));

  /** Фильтры таблиц: все сотрудники, включая заблокированных и удалённых. */
  readonly allNames = computed(() => this.sorted(this.list()));

  private sorted(list: StaffShort[]): string[] {
    const names = new Set(list.map((s) => s.name));
    const me = this.myName();
    if (me) {
      names.add(me);
    }
    return [...names].sort((a, b) => a.localeCompare(b, 'ru'));
  }

  /** Загрузить список (повторные вызовы ничего не делают). */
  load(): void {
    if (this.loaded || !this.auth.isLoggedIn()) {
      return;
    }
    this.loaded = true;
    this.http
      .get<StaffShort[]>(`${this.api}/staff`, { params: { includeInactive: true } })
      .subscribe({
        next: (list) => this.list.set(list),
        error: () => (this.loaded = false),
      });
  }
}
