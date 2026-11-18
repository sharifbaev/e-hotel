import { Component, computed, inject, linkedSignal, signal, viewChild } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ColDef } from 'ag-grid-community';
import { ButtonModule } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { MultiSelect } from 'primeng/multiselect';
import { Select } from 'primeng/select';
import { Observable } from 'rxjs';
import { ApiError } from '../../core/api/mock-api';
import { AuthService } from '../../core/auth/auth.service';
import {
  joinLogin,
  loginName,
  loginNameValidator,
  loginPrefixOf,
  orgLoginPrefix,
} from '../../core/auth/login-prefix';
import { UsersService } from '../../core/data/users.service';
import { LanguageService } from '../../core/i18n/language.service';
import { BreakpointService } from '../../core/layout/breakpoint.service';
import { TablePager } from '../../shared/grid/table-pager';
import { LoginPrefixInputDirective } from '../../shared/forms/login-prefix-input.directive';
import { PhoneInputDirective } from '../../shared/forms/phone-input.directive';
import { CopyButton } from '../../shared/ui/copy-button/copy-button';
import { Sheet } from '../../shared/ui/sheet/sheet';
import { RolesService } from '../../core/data/roles.service';
import { APP_SECTIONS, AccessLevel, RoleCode, StaffUser, StaffUserDraft } from '../../core/models';
import { NotifyService } from '../../core/notify/notify.service';
import { formatDateTime, initials } from '../../shared/format/format';
import { avatarCell, dotCell, pillCell } from '../../shared/grid/cells';
import { DataGrid } from '../../shared/grid/data-grid';
import { dateFilter } from '../../shared/grid/grid-filters';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog/confirm-dialog';
import { Icon, IconName } from '../../shared/ui/icon/icon';
import { RoleLabelPipe, roleLabel } from '../../shared/ui/status/role-label.pipe';
import { roleTone } from '../../shared/ui/status/status-styles';

const ACCESS_STYLE: Record<AccessLevel, { icon: IconName; bg: string; fg: string; key: string }> = {
  2: { icon: 'check', bg: '#E7F6EC', fg: '#067647', key: 'users.access.full' },
  1: { icon: 'eye', bg: '#DCE7FD', fg: '#1E3A8A', key: 'users.access.view' },
  0: { icon: 'minus', bg: '#F2F4F7', fg: '#667085', key: 'users.access.none' },
};

@Component({
  selector: 'app-users',
  imports: [
    LoginPrefixInputDirective,
    CopyButton,
    PhoneInputDirective,
    FormsModule,
    TablePager,
    Sheet,
    ReactiveFormsModule,
    TranslocoPipe,
    ButtonModule,
    Checkbox,
    Dialog,
    InputText,
    MultiSelect,
    Select,
    DataGrid,
    ConfirmDialog,
    Icon,
    RoleLabelPipe,
  ],
  templateUrl: './users.html',
})
export class UsersPage {
  private readonly api = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotifyService);
  private readonly transloco = inject(TranslocoService);
  private readonly lang = inject(LanguageService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly bp = inject(BreakpointService);

  private readonly grid = viewChild<DataGrid<StaffUser>>(DataGrid);

  private readonly res = rxResource({ stream: () => this.api.list() });
  private readonly rolesApi = inject(RolesService);
  /** Роли из «Настройки → Справочники» (GET /roles). */
  private readonly rolesRes = rxResource({ stream: () => this.rolesApi.list() });
  protected readonly roleList = computed(() =>
    this.rolesRes.hasValue() ? this.rolesRes.value() : this.rolesApi.roles(),
  );

  protected readonly users = linkedSignal<StaffUser[]>(() =>
    this.res.hasValue() ? this.res.value() : [],
  );
  protected readonly loading = computed(() => this.res.isLoading());
  protected readonly selected = signal<StaffUser | null>(null);
  protected readonly saving = signal(false);
  protected readonly meId = computed(() => this.auth.user()?.id ?? -1);

  // ----- v1.6: несколько отелей, аккаунт владельца -----
  /** Отели редактора — варианты поля «Отели». */
  protected readonly hotelOptions = computed(() => this.auth.hotels());
  /** Поле «Отели» — только если у редактора 2+ отеля. */
  protected readonly showHotels = computed(() => this.hotelOptions().length > 1);
  /** Выбран аккаунт владельца: блокировать, удалять и сбрасывать пароль нельзя (403 users.owner). */
  protected readonly selectedIsOwner = computed(() => this.selected()?.role === 'owner');
  /** Владельца редактирует только он сам (имя, логин, телефон, пароль). */
  protected readonly canEditSelected = computed(() => {
    const u = this.selected();
    return !!u && (u.role !== 'owner' || u.id === this.meId());
  });
  /** В форме — аккаунт владельца: роль и статус не меняются. */
  protected readonly editingOwner = signal(false);
  /** Роль owner другому сотруднику не назначается (422 fields.role). */
  protected readonly roleOptions = computed(() =>
    this.editingOwner() ? this.roleList() : this.roleList().filter((r) => r.code !== 'owner'),
  );
  /** Ошибки полей с сервера (422 fields.*): hotelIds, role. */
  protected readonly fieldErrors = signal<Record<string, string>>({});

  /** Матрица «Роли и права доступа»: раздел меню × роль (доступ есть / нет). */
  protected readonly permissions = computed(() =>
    this.rolesRes.isLoading()
      ? []
      : APP_SECTIONS.map((section) => ({
          section,
          cells: this.roleList().map((r) => ({
            role: r.code,
            ...ACCESS_STYLE[(r.sections.includes(section) ? 2 : 0) as AccessLevel],
          })),
        })),
  );

  private roleName(u: Pick<StaffUser, 'role' | 'roleName'>): string {
    return roleLabel(u.role, u.roleName, this.rolesApi, (k) => this.transloco.translate(k));
  }

  protected readonly columns = computed<ColDef<StaffUser>[]>(() => {
    this.lang.current();
    const t = (k: string, p?: Record<string, unknown>) => this.transloco.translate(k, p);
    const me = this.meId();
    return [
      {
        field: 'name',
        headerName: t('users.col.name'),
        flex: 2,
        minWidth: 220,
        cellRenderer: (p: { data: StaffUser }) => {
          const tone = roleTone(p.data.role);
          return avatarCell(p.data.name, {
            size: 32,
            bg: p.data.active ? tone.bg : '#F2F4F7',
            fg: p.data.active ? tone.fg : '#667085',
            sub: p.data.id === me ? t('users.you') : undefined,
          });
        },
      },
      {
        field: 'login',
        headerName: t('users.col.login'),
        flex: 1.1,
        cellClass: 'text-ink-2 tabular-nums',
      },
      {
        colId: 'role',
        headerName: t('users.col.role'),
        flex: 1.2,
        minWidth: 160,
        valueGetter: (p) => (p.data ? this.roleName(p.data) : ''),
        cellRenderer: (p: { data: StaffUser; value: string }) => {
          const tone = roleTone(p.data.role);
          return pillCell(p.value, tone.bg, tone.fg);
        },
      },
      {
        field: 'phone',
        headerName: t('users.col.phone'),
        flex: 1.3,
        minWidth: 180,
        cellClass: 'text-ink-2 tabular-nums',
      },
      {
        colId: 'status',
        headerName: t('users.col.status'),
        flex: 1,
        valueGetter: (p) => (p.data ? t(p.data.active ? 'users.active' : 'users.blocked') : ''),
        cellRenderer: (p: { data: StaffUser; value: string }) =>
          p.data.active
            ? dotCell(p.value, '#067647', '#2E8B57')
            : dotCell(p.value, '#B42318', '#D92D20'),
      },
      {
        colId: 'lastLogin',
        headerName: t('users.col.lastLogin'),
        flex: 1.3,
        minWidth: 180,
        // Значение — дата входа (для фильтра по периоду), подпись — в valueFormatter.
        valueGetter: (p) => p.data?.lastLogin ?? '',
        valueFormatter: (p) => {
          const u = p.data;
          if (!u) {
            return '';
          }
          if (u.online) {
            return t('users.online');
          }
          return u.lastLogin ? formatDateTime(u.lastLogin) : t('users.neverLoggedIn');
        },
        ...dateFilter<StaffUser>(),
        comparator: (_a, _b, na, nb) =>
          (na.data?.lastLogin ?? '').localeCompare(nb.data?.lastLogin ?? ''),
        cellClass: 'text-ink-2',
      },
    ];
  });

  protected readonly rowId = (p: { data: StaffUser }) => String(p.data.id);

  // ----- Форма -----
  protected readonly formOpen = signal(false);
  protected readonly editId = signal<number | null>(null);
  protected readonly tried = signal(false);
  /**
   * Префикс логина (v1.7): «<код владельца>_» — при создании из CurrentUser.organization.code,
   * при редактировании — из логина сотрудника. В поле формы — только часть после префикса.
   */
  protected readonly loginPrefix = signal('');
  protected readonly form = this.fb.group({
    name: ['', Validators.required],
    login: ['', [Validators.required, loginNameValidator(() => this.loginPrefix())]],
    phone: [''],
    role: this.fb.control<RoleCode>('admin'),
    active: [true],
    password: [''],
    hotelIds: this.fb.control<number[]>([]),
  });

  protected readonly confirmOpen = signal(false);

  protected select(u: StaffUser | null): void {
    this.selected.set(u);
  }

  // ===== Мобильная версия: карточки + пагинация, действия — в шторке =====
  protected readonly search = signal('');
  protected readonly pageSize = signal(10);
  protected readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.users().filter(
      (u) =>
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.login.toLowerCase().includes(q) ||
        u.phone.includes(q),
    );
  });
  /** Страница сбрасывается на первую при поиске и смене размера. */
  protected readonly page = linkedSignal({
    source: () => [this.search(), this.pageSize()] as const,
    computation: () => 0,
  });
  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / this.pageSize())),
  );
  protected readonly pageRows = computed(() => {
    const size = this.pageSize();
    const page = Math.min(this.page(), this.pageCount() - 1);
    return this.filtered().slice(page * size, page * size + size);
  });
  protected readonly sheetOpen = signal(false);

  protected goPage(p: number): void {
    this.page.set(Math.max(0, Math.min(p, this.pageCount() - 1)));
  }

  protected openCard(u: StaffUser): void {
    this.selected.set(u);
    this.sheetOpen.set(true);
  }

  /** Действие из шторки: закрыть её и выполнить. */
  protected fromSheet(action: () => void): void {
    this.sheetOpen.set(false);
    action();
  }

  protected userInitials(u: StaffUser): string {
    return initials(u.name);
  }

  protected tone(u: StaffUser): { bg: string; fg: string } {
    return u.active ? roleTone(u.role) : { bg: '#F2F4F7', fg: '#667085' };
  }

  /** «сейчас в сети» / дата последнего входа / «ещё не входил». */
  protected lastLogin(u: StaffUser): string {
    return u.online
      ? this.transloco.translate('users.online')
      : u.lastLogin
        ? formatDateTime(u.lastLogin)
        : this.transloco.translate('users.neverLoggedIn');
  }

  protected invalid(name: 'name' | 'login' | 'password'): boolean {
    return (this.tried() && this.form.controls[name].invalid) || !!this.fieldErrors()[name];
  }

  /** Роль по умолчанию для нового сотрудника: admin, если он есть, иначе первая доступная. */
  private defaultRole(): RoleCode {
    const list = this.roleList().filter((r) => r.code !== 'owner');
    return list.some((r) => r.code === 'admin') ? 'admin' : (list[0]?.code ?? 'admin');
  }

  /** Роль и статус владельца менять нельзя — поля выключены. */
  private lockOwnerFields(owner: boolean): void {
    this.editingOwner.set(owner);
    for (const c of [this.form.controls.role, this.form.controls.active]) {
      if (owner) {
        c.disable();
      } else {
        c.enable();
      }
    }
  }

  protected openAdd(): void {
    this.editId.set(null);
    this.tried.set(false);
    this.fieldErrors.set({});
    this.lockOwnerFields(false);
    this.loginPrefix.set(orgLoginPrefix(this.auth.user()?.organization?.code));
    const current = this.auth.hotelId();
    this.form.reset({
      name: '',
      login: '',
      phone: '',
      role: this.defaultRole(),
      active: true,
      password: '',
      hotelIds: current !== null ? [current] : [],
    });
    this.form.controls.password.setValidators([Validators.required, Validators.minLength(6)]);
    this.form.controls.password.updateValueAndValidity();
    this.formOpen.set(true);
  }

  protected openEdit(): void {
    const u = this.selected();
    if (!u || !this.canEditSelected()) {
      return;
    }
    this.editId.set(u.id);
    this.tried.set(false);
    this.fieldErrors.set({});
    this.lockOwnerFields(u.role === 'owner');
    // В поле — только отели редактора; прочие привязки сервер сохраняет сам.
    const mine = new Set(this.hotelOptions().map((h) => h.id));
    const prefix = loginPrefixOf(u.login) ?? orgLoginPrefix(this.auth.user()?.organization?.code);
    this.loginPrefix.set(prefix);
    this.form.reset({
      name: u.name,
      login: loginName(prefix, u.login),
      phone: u.phone,
      role: u.role,
      active: u.active,
      password: '',
      hotelIds: u.hotelIds.filter((id) => mine.has(id)),
    });
    this.form.controls.password.clearValidators();
    this.form.controls.password.updateValueAndValidity();
    this.formOpen.set(true);
  }

  /** Окно «Сменить пароль» для себя (POST /auth/change-password); само окно — в каркасе (Shell). */
  protected openChangePassword(): void {
    this.auth.passwordDialog.set(true);
  }

  protected generatePassword(): void {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    const bytes = new Uint32Array(10);
    crypto.getRandomValues(bytes);
    const pass = Array.from(bytes, (b) => chars.charAt(b % chars.length)).join('');
    this.form.controls.password.setValue(pass);
  }

  protected save(): void {
    this.tried.set(true);
    if (this.form.invalid) {
      this.notify.error(
        'users.toast.requiredTitle',
        this.editId() === null ? 'users.toast.requiredAdd' : 'users.toast.requiredEdit',
      );
      return;
    }
    const v = this.form.getRawValue();
    const withHotels = this.showHotels() && !this.editingOwner();
    if (withHotels && !v.hotelIds.length) {
      this.fieldErrors.set({ hotelIds: 'required' });
      this.notify.error('users.toast.requiredTitle', 'users.toast.hotelsRequired');
      return;
    }
    this.fieldErrors.set({});
    const draft: StaffUserDraft = {
      name: v.name.trim(),
      login: joinLogin(this.loginPrefix(), v.login),
      phone: v.phone.trim(),
      role: v.role,
      active: v.active,
      password: v.password || undefined,
      ...(withHotels ? { hotelIds: v.hotelIds } : {}),
    };
    const id = this.editId();
    if (id === this.meId() && !draft.active) {
      this.notify.error('users.toast.forbiddenTitle', 'users.toast.selfBlock');
      return;
    }
    const req: Observable<StaffUser> =
      id === null ? this.api.create(draft) : this.api.update(id, draft);
    this.saving.set(true);
    req.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.formOpen.set(false);
        if (id === null) {
          // Сотрудник в другом отеле в список текущего отеля не попадает.
          const here = this.auth.hotelId();
          if (here === null || !saved.hotelIds.length || saved.hotelIds.includes(here)) {
            this.users.update((l) => [...l, saved]);
          }
          // Пароль задал создатель — показываем логин и пароль, чтобы передать сотруднику.
          this.tempPassword.set({
            name: saved.name,
            login: saved.login,
            password: draft.password ?? '',
          });
          this.copied.set(false);
        } else {
          this.users.update((l) => l.map((u) => (u.id === id ? saved : u)));
          this.notify.success('common.savedTitle', 'users.toast.updatedText', { name: saved.name });
        }
        this.selected.set(saved);
      },
      error: (e: unknown) => {
        this.saving.set(false);
        if (e instanceof ApiError && Object.keys(e.fields).length) {
          // 422: fields.hotelIds / fields.role = invalid — показываем у поля.
          this.fieldErrors.set(e.fields);
        }
        if (e instanceof ApiError && e.code === 'users.loginTaken') {
          this.notify.error('users.toast.loginTakenTitle', 'users.toast.loginTakenText', {
            login: draft.login,
          });
        } else {
          this.notify.error(
            'common.saveError',
            e instanceof ApiError ? `errors.${e.code}` : 'errors.common.unknown',
          );
        }
      },
    });
  }

  protected toggleBlock(): void {
    const u = this.selected();
    if (!u) {
      return;
    }
    if (u.id === this.meId()) {
      this.notify.error('users.toast.forbiddenTitle', 'users.toast.selfBlock');
      return;
    }
    if (u.role === 'owner') {
      this.notify.error('users.toast.forbiddenTitle', 'errors.users.owner');
      return;
    }
    this.api.setActive(u.id, !u.active).subscribe({
      next: (saved) => {
        this.users.update((l) => l.map((x) => (x.id === saved.id ? saved : x)));
        this.selected.set(saved);
        this.notify.success(
          saved.active ? 'users.toast.unblockedTitle' : 'users.toast.blockedTitle',
          saved.active ? 'users.toast.unblockedText' : 'users.toast.blockedText',
          { name: saved.name },
        );
      },
      error: (e: unknown) =>
        this.notify.error(
          'common.saveError',
          e instanceof ApiError ? `errors.${e.code}` : 'errors.common.unknown',
        ),
    });
  }

  protected resetPassword(): void {
    const u = this.selected();
    if (!u) {
      return;
    }
    if (u.role === 'owner') {
      this.notify.error('users.toast.forbiddenTitle', 'errors.users.owner');
      return;
    }
    this.api.resetPassword(u.id).subscribe({
      next: (r) => {
        // Сервер вернул временный пароль (SMS пока нет) — показываем его администратору.
        if (r?.temporaryPassword) {
          this.tempPassword.set({ name: u.name, password: r.temporaryPassword });
          this.copied.set(false);
          return;
        }
        this.notify.success('users.toast.passwordResetTitle', 'users.toast.passwordResetText', {
          phone: u.phone,
        });
      },
      error: (e: unknown) =>
        this.notify.error(
          'common.saveError',
          e instanceof ApiError ? `errors.${e.code}` : 'errors.common.unknown',
        ),
    });
  }

  /** Окно «Роли и права доступа». */
  protected readonly rolesOpen = signal(false);

  // ----- Пароль один раз: после сброса или логин + пароль после создания (login задан) -----
  protected readonly tempPassword = signal<{
    name: string;
    password: string;
    login?: string;
  } | null>(null);
  protected readonly copied = signal(false);

  protected closeTempPassword(): void {
    this.tempPassword.set(null);
  }

  protected async copyTempPassword(): Promise<void> {
    const t = this.tempPassword();
    if (!t?.password) {
      return;
    }
    const text = t.login
      ? `${this.transloco.translate('users.form.login')}: ${t.login}\n` +
        `${this.transloco.translate('users.created.password')}: ${t.password}`
      : t.password;
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(true);
    } catch {
      // буфер обмена недоступен (нет HTTPS / запрет браузера) — пароль виден на экране
      this.notify.error('users.tempPassword.copyFailTitle', 'users.tempPassword.copyFailText');
    }
  }

  protected askDelete(): void {
    const u = this.selected();
    if (!u) {
      return;
    }
    if (u.id === this.meId()) {
      this.notify.error('users.toast.forbiddenTitle', 'users.toast.selfDelete');
      return;
    }
    if (u.role === 'owner') {
      this.notify.error('users.toast.forbiddenTitle', 'errors.users.owner');
      return;
    }
    this.confirmOpen.set(true);
  }

  protected doDelete(): void {
    const u = this.selected();
    if (!u) {
      return;
    }
    this.saving.set(true);
    this.api.remove(u.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.confirmOpen.set(false);
        this.users.update((l) => l.filter((x) => x.id !== u.id));
        this.selected.set(null);
        this.grid()?.clearSelection();
        this.notify.success('users.toast.deletedTitle', 'users.toast.deletedText', {
          name: u.name,
        });
      },
      error: (e: unknown) => {
        this.saving.set(false);
        this.confirmOpen.set(false);
        this.notify.error(
          'common.saveError',
          e instanceof ApiError ? `errors.${e.code}` : 'errors.common.unknown',
        );
      },
    });
  }
}
