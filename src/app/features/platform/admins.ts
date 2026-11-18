import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ColDef } from 'ag-grid-community';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { ApiError } from '../../core/api/mock-api';
import { AuthService } from '../../core/auth/auth.service';
import { PLATFORM_LOGIN_PREFIX, joinLogin, loginNameValidator } from '../../core/auth/login-prefix';
import { PlatformService, generatePassword } from '../../core/data/platform.service';
import { LanguageService } from '../../core/i18n/language.service';
import { PlatformAdmin } from '../../core/models';
import { NotifyService } from '../../core/notify/notify.service';
import { formatDateTime } from '../../shared/format/format';
import { avatarCell, dotCell } from '../../shared/grid/cells';
import { LoginPrefixInputDirective } from '../../shared/forms/login-prefix-input.directive';
import { DataGrid } from '../../shared/grid/data-grid';
import { CopyButton } from '../../shared/ui/copy-button/copy-button';
import {
  CredentialRow,
  CredentialsDialog,
} from '../../shared/ui/credentials-dialog/credentials-dialog';
import { Icon } from '../../shared/ui/icon/icon';

/** Платформа → «Супер-админы» (v1.6): список, добавление, блокировка. */
@Component({
  selector: 'app-platform-admins',
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    ButtonModule,
    Dialog,
    LoginPrefixInputDirective,
    CopyButton,
    InputText,
    DataGrid,
    CredentialsDialog,
    Icon,
  ],
  template: `
    <div class="flex flex-col gap-4 px-6 pt-5 pb-8 max-md:px-4 max-md:pt-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="m-0 text-2xl font-bold tracking-[-0.01em] max-md:text-xl">
            {{ 'platform.admins.title' | transloco }}
          </h1>
          <p class="mt-1 mb-0 text-[13px] text-muted">
            {{ 'platform.admins.subtitle' | transloco }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            pButton
            type="button"
            severity="secondary"
            [outlined]="true"
            [disabled]="!selected() || selected()!.id === meId()"
            (click)="toggle()"
          >
            <app-icon name="lock" />
            <span pButtonLabel>{{
              (selected() && !selected()!.active ? 'users.unblock' : 'users.block') | transloco
            }}</span>
          </button>
          <button pButton type="button" (click)="openAdd()">
            <app-icon name="plus" />
            <span pButtonLabel>{{ 'common.add' | transloco }}</span>
          </button>
        </div>
      </div>
      <section class="overflow-hidden rounded-xl border border-line bg-white">
        <app-data-grid
          [rows]="rows()"
          [columns]="columns()"
          [loading]="res.isLoading()"
          [selectable]="true"
          [getRowId]="rowId"
          [minWidth]="760"
          (selection)="selected.set($event)"
        />
      </section>
    </div>

    <p-dialog
      [(visible)]="formOpen"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [header]="'platform.admins.addTitle' | transloco"
      [style]="{ width: '480px', maxWidth: 'calc(100vw - 32px)' }"
      styleClass="hs-dialog"
      [closeAriaLabel]="'common.close' | transloco"
    >
      <form
        id="admin-form"
        class="flex flex-col gap-4"
        [formGroup]="form"
        (ngSubmit)="save()"
        novalidate
      >
        <div class="field">
          <label for="pa-name" class="field-label"
            >{{ 'users.form.name' | transloco }} <span class="req">*</span></label
          >
          <input
            id="pa-name"
            pInputText
            formControlName="name"
            [invalid]="bad(form.controls.name)"
          />
        </div>
        <div class="field">
          <label for="pa-login" class="field-label"
            >{{ 'users.form.login' | transloco }} <span class="req">*</span></label
          >
          <!-- v1.7: одно поле «platform_…», начало стереть нельзя -->
          <div class="flex gap-2">
            <input
              id="pa-login"
              pInputText
              formControlName="login"
              [appLoginPrefix]="prefix"
              class="min-w-0 flex-1 font-mono"
              [invalid]="bad(form.controls.login) || !!loginError()"
              [attr.aria-invalid]="bad(form.controls.login) || !!loginError()"
            />
            <app-copy-button [value]="prefix + form.controls.login.value" />
          </div>
          <span class="hint" [class.text-danger]="!!loginError()">{{
            (loginError() === 'taken'
              ? 'errors.users.loginTaken'
              : loginError() === 'prefix'
                ? 'users.form.loginPrefix'
                : 'users.form.loginHint'
            ) | transloco: { prefix }
          }}</span>
        </div>
        <div class="field">
          <label for="pa-pass" class="field-label"
            >{{ 'users.form.password' | transloco }} <span class="req">*</span></label
          >
          <div class="flex gap-2">
            <input
              id="pa-pass"
              pInputText
              formControlName="password"
              autocomplete="new-password"
              class="min-w-0 flex-1 font-mono"
              [invalid]="bad(form.controls.password)"
            />
            <button
              pButton
              type="button"
              severity="secondary"
              [outlined]="true"
              (click)="generate()"
            >
              <app-icon name="refresh" />
              <span pButtonLabel>{{ 'users.form.generate' | transloco }}</span>
            </button>
          </div>
          <span class="hint">{{ 'password.hint' | transloco }}</span>
        </div>
      </form>
      <ng-template #footer>
        <button
          pButton
          type="button"
          severity="secondary"
          [outlined]="true"
          (click)="formOpen.set(false)"
        >
          <span pButtonLabel>{{ 'common.cancel' | transloco }}</span>
        </button>
        <button pButton type="submit" form="admin-form" [loading]="saving()">
          <span pButtonLabel>{{ 'common.save' | transloco }}</span>
        </button>
      </ng-template>
    </p-dialog>

    <app-credentials-dialog
      [(visible)]="credsOpen"
      title="users.created.title"
      text="users.created.text"
      [params]="{ name: credsName() }"
      [rows]="creds()"
    />
  `,
})
export class AdminsPage {
  private readonly api = inject(PlatformService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotifyService);
  private readonly transloco = inject(TranslocoService);
  private readonly lang = inject(LanguageService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly res = rxResource({ stream: () => this.api.admins() });
  protected readonly rows = linkedSignal<PlatformAdmin[]>(() =>
    this.res.hasValue() ? this.res.value() : [],
  );
  protected readonly selected = signal<PlatformAdmin | null>(null);
  protected readonly meId = computed(() => this.auth.user()?.id ?? -1);
  protected readonly rowId = (p: { data: PlatformAdmin }) => String(p.data.id);

  protected readonly columns = computed<ColDef<PlatformAdmin>[]>(() => {
    this.lang.current();
    const t = (k: string) => this.transloco.translate(k);
    const me = this.meId();
    return [
      {
        field: 'name',
        headerName: t('users.col.name'),
        flex: 2,
        minWidth: 220,
        cellRenderer: (p: { data: PlatformAdmin }) =>
          avatarCell(p.data.name, { size: 32, sub: p.data.id === me ? t('users.you') : undefined }),
      },
      { field: 'login', headerName: t('users.form.login'), flex: 1.2, minWidth: 140 },
      {
        colId: 'status',
        headerName: t('users.col.status'),
        flex: 1,
        minWidth: 130,
        valueGetter: (p) => (p.data ? t(p.data.active ? 'users.active' : 'users.blocked') : ''),
        cellRenderer: (p: { data: PlatformAdmin; value: string }) =>
          p.data.active
            ? dotCell(p.value, '#067647', '#2E8B57')
            : dotCell(p.value, '#B42318', '#D92D20'),
      },
      {
        colId: 'lastLogin',
        headerName: t('users.col.lastLogin'),
        flex: 1.3,
        minWidth: 180,
        valueGetter: (p) => p.data?.lastLogin ?? '',
        valueFormatter: (p) => (p.value ? formatDateTime(p.value) : t('users.neverLoggedIn')),
        cellClass: 'tabular-nums text-ink-2',
      },
    ];
  });

  // ----- Добавление -----
  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly tried = signal(false);
  /** Ошибка логина с сервера: taken (409) | prefix (422 fields.login = prefix). */
  protected readonly loginError = signal<'' | 'taken' | 'prefix'>('');
  /** Логин супер-админа = platform_<имя> (v1.7); в поле — только имя. */
  protected readonly prefix = PLATFORM_LOGIN_PREFIX;
  protected readonly form = this.fb.group({
    name: ['', Validators.required],
    login: ['', [Validators.required, loginNameValidator(() => PLATFORM_LOGIN_PREFIX)]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected bad(c: AbstractControl): boolean {
    return this.tried() && c.invalid;
  }

  protected openAdd(): void {
    this.form.reset({ name: '', login: '', password: generatePassword() });
    this.tried.set(false);
    this.loginError.set('');
    this.formOpen.set(true);
  }

  protected generate(): void {
    this.form.controls.password.setValue(generatePassword());
  }

  protected save(): void {
    this.tried.set(true);
    if (this.form.invalid) {
      this.notify.error('users.toast.requiredTitle', 'users.toast.requiredAdd');
      return;
    }
    const v = this.form.getRawValue();
    const draft = {
      name: v.name.trim(),
      login: joinLogin(PLATFORM_LOGIN_PREFIX, v.login),
      password: v.password,
    };
    this.saving.set(true);
    this.api.createAdmin(draft).subscribe({
      next: (a) => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.rows.update((l) => [...l, a]);
        this.credsName.set(a.name);
        this.creds.set([
          { label: 'platform.handover.link', value: location.origin },
          { label: 'platform.owner.login', value: a.login, mono: true },
          { label: 'platform.owner.password', value: draft.password, mono: true },
        ]);
        this.credsOpen.set(true);
      },
      error: (e: unknown) => {
        this.saving.set(false);
        this.loginError.set(
          e instanceof ApiError && e.code === 'users.loginTaken'
            ? 'taken'
            : e instanceof ApiError && e.fields['login'] === 'prefix'
              ? 'prefix'
              : '',
        );
        this.notify.error(
          'common.saveError',
          e instanceof ApiError ? `errors.${e.code}` : 'errors.common.unknown',
        );
      },
    });
  }

  protected toggle(): void {
    const a = this.selected();
    if (!a || a.id === this.meId()) {
      return;
    }
    this.api.setAdminActive(a.id, !a.active).subscribe({
      next: (saved) => {
        this.rows.update((l) => l.map((x) => (x.id === saved.id ? saved : x)));
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

  protected readonly credsOpen = signal(false);
  protected readonly credsName = signal('');
  protected readonly creds = signal<CredentialRow[]>([]);
}
