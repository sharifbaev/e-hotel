import { Component, computed, inject, linkedSignal, signal, viewChild } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ColDef } from 'ag-grid-community';
import { ButtonModule } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Observable } from 'rxjs';
import { ApiError } from '../../core/api/mock-api';
import { AuthService } from '../../core/auth/auth.service';
import { UsersService } from '../../core/data/users.service';
import { LanguageService } from '../../core/i18n/language.service';
import { RolesService } from '../../core/data/roles.service';
import { APP_SECTIONS, AccessLevel, RoleCode, StaffUser, StaffUserDraft } from '../../core/models';
import { NotifyService } from '../../core/notify/notify.service';
import { formatDateTime } from '../../shared/format/format';
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
    ReactiveFormsModule,
    TranslocoPipe,
    ButtonModule,
    Checkbox,
    Dialog,
    InputText,
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
        minWidth: 170,
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
  protected readonly form = this.fb.group({
    name: ['', Validators.required],
    login: ['', [Validators.required, Validators.pattern(/^[a-z0-9._-]{3,32}$/)]],
    phone: [''],
    role: this.fb.control<RoleCode>('admin'),
    active: [true],
    password: [''],
  });

  protected readonly confirmOpen = signal(false);

  protected select(u: StaffUser | null): void {
    this.selected.set(u);
  }

  protected invalid(name: 'name' | 'login' | 'password'): boolean {
    return this.tried() && this.form.controls[name].invalid;
  }

  protected openAdd(): void {
    this.editId.set(null);
    this.tried.set(false);
    this.form.reset({
      name: '',
      login: '',
      phone: '',
      role: 'admin',
      active: true,
      password: '',
    });
    this.form.controls.password.setValidators([Validators.required, Validators.minLength(6)]);
    this.form.controls.password.updateValueAndValidity();
    this.formOpen.set(true);
  }

  protected openEdit(): void {
    const u = this.selected();
    if (!u) {
      return;
    }
    this.editId.set(u.id);
    this.tried.set(false);
    this.form.reset({
      name: u.name,
      login: u.login,
      phone: u.phone,
      role: u.role,
      active: u.active,
      password: '',
    });
    this.form.controls.password.clearValidators();
    this.form.controls.password.updateValueAndValidity();
    this.formOpen.set(true);
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
    const draft: StaffUserDraft = {
      name: v.name.trim(),
      login: v.login.trim(),
      phone: v.phone.trim(),
      role: v.role,
      active: v.active,
      password: v.password || undefined,
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
          this.users.update((l) => [...l, saved]);
          this.notify.success('users.toast.addedTitle', 'users.toast.addedText', {
            name: saved.name,
            role: this.roleName(saved),
            login: saved.login,
          });
        } else {
          this.users.update((l) => l.map((u) => (u.id === id ? saved : u)));
          this.notify.success('common.savedTitle', 'users.toast.updatedText', { name: saved.name });
        }
        this.selected.set(saved);
      },
      error: (e: unknown) => {
        this.saving.set(false);
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

  // ----- Временный пароль после сброса -----
  protected readonly tempPassword = signal<{ name: string; password: string } | null>(null);
  protected readonly copied = signal(false);

  protected closeTempPassword(): void {
    this.tempPassword.set(null);
  }

  protected async copyTempPassword(): Promise<void> {
    const p = this.tempPassword()?.password;
    if (!p) {
      return;
    }
    try {
      await navigator.clipboard.writeText(p);
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
