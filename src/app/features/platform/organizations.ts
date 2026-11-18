import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, catchError, debounceTime, of, switchMap } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ColDef } from 'ag-grid-community';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { ApiError } from '../../core/api/mock-api';
import { joinLogin, loginNameValidator, orgLoginPrefix } from '../../core/auth/login-prefix';
import { PlatformService, generatePassword } from '../../core/data/platform.service';
import { LanguageService } from '../../core/i18n/language.service';
import { CodeCheck, Organization, OwnerShort } from '../../core/models';
import { NotifyService } from '../../core/notify/notify.service';
import { formatDateTime } from '../../shared/format/format';
import { dotCell } from '../../shared/grid/cells';
import { DataGrid } from '../../shared/grid/data-grid';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog/confirm-dialog';
import { LoginPrefixInputDirective } from '../../shared/forms/login-prefix-input.directive';
import { PhoneInputDirective } from '../../shared/forms/phone-input.directive';
import { CopyButton } from '../../shared/ui/copy-button/copy-button';
import {
  CredentialRow,
  CredentialsDialog,
} from '../../shared/ui/credentials-dialog/credentials-dialog';
import { Icon } from '../../shared/ui/icon/icon';
import { HotelFields, hotelDraft, hotelGroup } from './hotel-fields';

/** Код владельца (префикс логинов): 3–30 символов, строчная латиница, цифры и «-» в середине, без «_». */
const CODE_RE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;
const RESERVED = ['www', 'api', 'admin', 'app', 'static', 'mail', 'platform'];

function codeValidator(c: AbstractControl<string>) {
  const v = c.value ?? '';
  return CODE_RE.test(v) && !RESERVED.includes(v) ? null : { code: true };
}

/** Платформа → «Владельцы»: таблица владельцев и форма «Новый владелец» (v1.6). */
@Component({
  selector: 'app-platform-organizations',
  imports: [
    FormsModule,
    ConfirmDialog,
    ReactiveFormsModule,
    PhoneInputDirective,
    TranslocoPipe,
    ButtonModule,
    Dialog,
    LoginPrefixInputDirective,
    CopyButton,
    InputText,
    DataGrid,
    CredentialsDialog,
    Icon,
    HotelFields,
  ],
  template: `
    <div class="flex flex-col gap-4 px-6 pt-5 pb-8 max-md:px-4 max-md:pt-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="m-0 text-2xl font-bold tracking-[-0.01em] max-md:text-xl">
            {{ 'platform.orgs.title' | transloco }}
          </h1>
          <p class="mt-1 mb-0 text-[13px] text-muted">{{ 'platform.orgs.subtitle' | transloco }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            pButton
            type="button"
            severity="secondary"
            [outlined]="true"
            [disabled]="!selected()"
            (click)="open(selected()!)"
          >
            <app-icon name="external" />
            <span pButtonLabel>{{ 'platform.orgs.open' | transloco }}</span>
          </button>
          <button
            pButton
            type="button"
            severity="secondary"
            [outlined]="true"
            [disabled]="!selected()"
            (click)="openRename()"
          >
            <app-icon name="edit" />
            <span pButtonLabel>{{ 'platform.org.rename' | transloco }}</span>
          </button>
          <button
            pButton
            type="button"
            severity="secondary"
            [outlined]="true"
            [disabled]="!selected()?.owners?.length"
            (click)="resetOpen.set(true)"
          >
            <app-icon name="key" />
            <span pButtonLabel>{{ 'users.resetPassword' | transloco }}</span>
          </button>
          <button
            pButton
            type="button"
            [severity]="selected()?.active === false ? 'secondary' : 'danger'"
            [outlined]="true"
            [disabled]="!selected()"
            (click)="blockOpen.set(true)"
          >
            <app-icon name="lock" />
            <span pButtonLabel>{{
              (selected()?.active === false ? 'users.unblock' : 'users.block') | transloco
            }}</span>
          </button>
          <button pButton type="button" (click)="openAdd()">
            <app-icon name="plus" />
            <span pButtonLabel>{{ 'platform.orgs.add' | transloco }}</span>
          </button>
        </div>
      </div>

      <section class="overflow-hidden rounded-xl border border-line bg-white">
        <app-data-grid
          [rows]="rows()"
          [columns]="columns()"
          [loading]="res.isLoading()"
          [selectable]="true"
          [details]="false"
          [getRowId]="rowId"
          emptyText="platform.orgs.empty"
          [minWidth]="1100"
          (selection)="selected.set($event)"
          (rowDoubleClick)="open($event)"
        />
      </section>
    </div>

    <!-- Новый владелец: владелец + аккаунт владельца + первый отель -->
    <p-dialog
      [(visible)]="formOpen"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [header]="'platform.orgs.addTitle' | transloco"
      [style]="{ width: '640px', maxWidth: 'calc(100vw - 32px)' }"
      styleClass="hs-dialog"
      [closeAriaLabel]="'common.close' | transloco"
    >
      <form
        id="org-form"
        class="flex flex-col gap-5"
        [formGroup]="form"
        (ngSubmit)="save()"
        novalidate
      >
        <fieldset class="m-0 flex flex-col gap-3 border-0 p-0">
          <legend class="mb-2 text-[15px] font-semibold">
            {{ 'platform.orgs.partOrg' | transloco }}
          </legend>
          <div class="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            <div class="field">
              <label for="o-code" class="field-label"
                >{{ 'platform.orgs.code' | transloco }} <span class="req">*</span></label
              >
              <input
                id="o-code"
                pInputText
                formControlName="code"
                autocomplete="off"
                placeholder="grand"
                [invalid]="codeBad()"
                [attr.aria-invalid]="codeBad()"
                aria-describedby="o-code-hint"
              />
              <span
                id="o-code-hint"
                class="hint"
                [class.text-danger]="codeBad()"
                [class.text-success]="codeFree()"
                aria-live="polite"
                >{{ codeHintKey() | transloco }}</span
              >
            </div>
            <div class="field">
              <label for="o-name" class="field-label"
                >{{ 'platform.orgs.name' | transloco }} <span class="req">*</span></label
              >
              <input
                id="o-name"
                pInputText
                formControlName="name"
                placeholder="Grand Group"
                [invalid]="bad(form.controls.name)"
                [attr.aria-invalid]="bad(form.controls.name)"
              />
            </div>
          </div>
        </fieldset>

        <fieldset class="m-0 flex flex-col gap-3 border-0 p-0" [formGroup]="form.controls.owner">
          <legend class="mb-2 text-[15px] font-semibold">
            {{ 'platform.orgs.partOwner' | transloco }}
          </legend>
          <div class="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            <div class="field">
              <label for="ow-name" class="field-label"
                >{{ 'platform.owner.name' | transloco }} <span class="req">*</span></label
              >
              <input
                id="ow-name"
                pInputText
                formControlName="name"
                [invalid]="bad(form.controls.owner.controls.name)"
                [attr.aria-invalid]="bad(form.controls.owner.controls.name)"
              />
            </div>
            <div class="field">
              <label for="ow-phone" class="field-label">{{
                'platform.owner.phone' | transloco
              }}</label>
              <input id="ow-phone" pInputText appPhone formControlName="phone" />
            </div>
            <div class="field">
              <label for="ow-login" class="field-label"
                >{{ 'platform.owner.login' | transloco }} <span class="req">*</span></label
              >
              <!-- v1.7: одно поле «<код>_…», начало берётся из кода и не стирается -->
              <div class="flex gap-2">
                <input
                  id="ow-login"
                  pInputText
                  formControlName="login"
                  [appLoginPrefix]="ownerPrefix()"
                  class="min-w-0 flex-1 font-mono"
                  [invalid]="loginBad()"
                  [attr.aria-invalid]="loginBad()"
                  aria-describedby="ow-login-hint"
                />
                <app-copy-button
                  [value]="ownerPrefix() + form.controls.owner.controls.login.value"
                />
              </div>
              <span id="ow-login-hint" class="hint" [class.text-danger]="loginBad()">{{
                (serverErrors()['login'] === 'taken'
                  ? 'errors.users.loginTaken'
                  : serverErrors()['login'] === 'prefix'
                    ? 'users.form.loginPrefix'
                    : 'users.form.loginHint'
                ) | transloco: { prefix: ownerPrefix() }
              }}</span>
            </div>
            <div class="field">
              <label for="ow-pass" class="field-label"
                >{{ 'platform.owner.password' | transloco }} <span class="req">*</span></label
              >
              <div class="flex gap-2">
                <input
                  id="ow-pass"
                  pInputText
                  formControlName="password"
                  autocomplete="new-password"
                  class="min-w-0 flex-1 font-mono"
                  [invalid]="bad(form.controls.owner.controls.password)"
                  [attr.aria-invalid]="bad(form.controls.owner.controls.password)"
                />
                <button
                  pButton
                  type="button"
                  severity="secondary"
                  [outlined]="true"
                  [attr.aria-label]="'users.form.generate' | transloco"
                  (click)="generate()"
                >
                  <app-icon name="refresh" />
                </button>
              </div>
              <span class="hint">{{ 'password.hint' | transloco }}</span>
            </div>
          </div>
        </fieldset>

        <fieldset class="m-0 flex flex-col gap-3 border-0 p-0">
          <legend class="mb-2 text-[15px] font-semibold">
            {{ 'platform.orgs.partHotel' | transloco }}
          </legend>
          <app-hotel-fields
            [group]="form.controls.hotel"
            [tried]="tried()"
            [innError]="serverErrors()['inn'] === 'invalid'"
            prefix="oh"
          />
        </fieldset>
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
        <button
          pButton
          type="submit"
          form="org-form"
          [loading]="saving()"
          [disabled]="codeCheck()?.available === false"
        >
          @if (!saving()) {
            <app-icon name="check" />
          }
          <span pButtonLabel>{{ 'platform.orgs.create' | transloco }}</span>
        </button>
      </ng-template>
    </p-dialog>

    <!-- Переименовать владельца (код не меняется) -->
    <p-dialog
      [(visible)]="renameOpen"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [header]="'platform.org.rename' | transloco"
      [style]="{ width: '440px', maxWidth: 'calc(100vw - 32px)' }"
      styleClass="hs-dialog"
      [closeAriaLabel]="'common.close' | transloco"
    >
      <form id="rename-form" class="field" (ngSubmit)="rename()" novalidate>
        <label for="r-org-name" class="field-label"
          >{{ 'platform.orgs.name' | transloco }} <span class="req">*</span></label
        >
        <input
          id="r-org-name"
          name="name"
          pInputText
          [ngModel]="newName()"
          (ngModelChange)="newName.set($event)"
          [invalid]="!newName().trim()"
        />
        <span class="hint">{{ 'platform.org.codeFixed' | transloco }}</span>
      </form>
      <ng-template #footer>
        <button
          pButton
          type="button"
          severity="secondary"
          [outlined]="true"
          (click)="renameOpen.set(false)"
        >
          <span pButtonLabel>{{ 'common.cancel' | transloco }}</span>
        </button>
        <button
          pButton
          type="submit"
          form="rename-form"
          [loading]="busy()"
          [disabled]="!newName().trim()"
        >
          <span pButtonLabel>{{ 'common.save' | transloco }}</span>
        </button>
      </ng-template>
    </p-dialog>

    <!-- Сбросить пароль: аккаунты выбранного владельца, у каждого своя кнопка -->
    <p-dialog
      [(visible)]="resetOpen"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [header]="'platform.confirm.resetTitle' | transloco"
      [style]="{ width: '480px', maxWidth: 'calc(100vw - 32px)' }"
      styleClass="hs-dialog"
      [closeAriaLabel]="'common.close' | transloco"
    >
      <div class="flex flex-col gap-3">
        <p class="m-0 text-sm text-ink-2">{{ 'platform.orgs.resetText' | transloco }}</p>
        @for (u of selected()?.owners ?? []; track u.id) {
          <div class="flex items-center gap-3 rounded-[10px] border border-line px-4 py-3">
            <span class="flex min-w-0 flex-1 flex-col gap-0.5">
              <span class="truncate text-sm font-semibold">{{ u.name }}</span>
              <span class="truncate font-mono text-xs text-muted">{{ u.login }}</span>
            </span>
            <button
              pButton
              type="button"
              size="small"
              severity="secondary"
              [outlined]="true"
              [loading]="resetting() === u.id"
              [disabled]="resetting() !== null"
              (click)="resetPassword(u)"
            >
              <app-icon name="key" />
              <span pButtonLabel>{{ 'users.resetPassword' | transloco }}</span>
            </button>
          </div>
        }
      </div>
    </p-dialog>

    <!-- Заблокировать / разблокировать владельца (все его отели) -->
    <app-confirm-dialog
      [(visible)]="blockOpen"
      [title]="
        selected()?.active === false
          ? 'platform.confirm.unblockOrgTitle'
          : 'platform.confirm.blockOrgTitle'
      "
      [text]="
        selected()?.active === false
          ? 'platform.confirm.unblockOrgText'
          : 'platform.confirm.blockOrgText'
      "
      [params]="{ name: selected()?.name ?? '' }"
      [confirmLabel]="selected()?.active === false ? 'users.unblock' : 'users.block'"
      [busy]="busy()"
      (confirm)="toggleBlock()"
    />

    <!-- Новый пароль владельца (один раз) -->
    <app-credentials-dialog
      [(visible)]="credsOpen"
      title="platform.reset.title"
      text="platform.reset.text"
      [params]="{ name: credsName() }"
      [rows]="creds()"
    />

    <!-- «Передать владельцу»: логин и пароль один раз (+ общий адрес сайта) -->
    <app-credentials-dialog
      [(visible)]="handoverOpen"
      title="platform.handover.title"
      text="platform.handover.text"
      [params]="{ name: handoverName() }"
      [rows]="handover()"
    />
  `,
})
export class OrganizationsPage {
  private readonly api = inject(PlatformService);
  private readonly router = inject(Router);
  private readonly notify = inject(NotifyService);
  private readonly transloco = inject(TranslocoService);
  private readonly lang = inject(LanguageService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly res = rxResource({ stream: () => this.api.organizations() });
  protected readonly rows = linkedSignal<Organization[]>(() =>
    this.res.hasValue() ? this.res.value() : [],
  );
  protected readonly selected = signal<Organization | null>(null);
  protected readonly rowId = (p: { data: Organization }) => String(p.data.id);

  protected readonly columns = computed<ColDef<Organization>[]>(() => {
    this.lang.current();
    const t = (k: string) => this.transloco.translate(k);
    return [
      {
        field: 'code',
        headerName: t('platform.orgs.col.code'),
        flex: 1.2,
        minWidth: 200,
        cellClass: 'font-mono font-semibold',
      },
      { field: 'name', headerName: t('platform.orgs.col.name'), flex: 1.5, minWidth: 200 },
      {
        colId: 'status',
        headerName: t('platform.orgs.col.status'),
        flex: 1,
        minWidth: 140,
        valueGetter: (p) => (p.data ? t(p.data.active ? 'users.active' : 'users.blocked') : ''),
        cellRenderer: (p: { data: Organization; value: string }) =>
          p.data.active
            ? dotCell(p.value, '#067647', '#2E8B57')
            : dotCell(p.value, '#B42318', '#D92D20'),
      },
      {
        colId: 'createdAt',
        headerName: t('platform.orgs.col.createdAt'),
        flex: 1.1,
        minWidth: 170,
        valueGetter: (p) => p.data?.createdAt ?? '',
        valueFormatter: (p) => formatDateTime(p.value),
        cellClass: 'tabular-nums text-ink-2',
      },
      {
        colId: 'hotels',
        headerName: t('platform.orgs.col.hotels'),
        flex: 2,
        minWidth: 220,
        valueGetter: (p) => p.data?.hotels.map((h) => h.name).join(', ') ?? '',
      },
      {
        colId: 'owners',
        headerName: t('platform.orgs.col.owners'),
        flex: 1.6,
        minWidth: 200,
        valueGetter: (p) => p.data?.owners.map((o) => `${o.name} (${o.login})`).join(', ') ?? '',
      },
    ];
  });

  // ----- Новый владелец -----
  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly tried = signal(false);
  /** Ошибки с сервера: code = exists | invalid, login = taken, inn = invalid. */
  protected readonly serverErrors = signal<Record<string, string>>({});
  protected readonly form = this.fb.group({
    code: ['', [Validators.required, codeValidator]],
    name: ['', Validators.required],
    owner: this.fb.group({
      name: ['', Validators.required],
      // Только имя; полный логин = <код>_<имя> (v1.7).
      login: ['', [Validators.required, loginNameValidator(() => this.ownerPrefix())]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      phone: [''],
    }),
    hotel: hotelGroup(this.fb),
  });
  private readonly codeValue = signal('');
  /** Префикс логина владельца: «<код>_» — обновляется по мере ввода кода. */
  protected readonly ownerPrefix = computed(() => orgLoginPrefix(this.codeValue()));

  /** v1.7: результат GET /platform/organizations/code-check для текущего кода; null — нет/ждём. */
  protected readonly codeCheck = signal<CodeCheck | null>(null);
  private readonly codeInput = new Subject<string>();
  protected readonly codeFree = computed(
    () => !this.codeBad() && this.codeCheck()?.available === true,
  );
  protected readonly codeHintKey = computed(() => {
    const server = this.serverErrors()['code'];
    if (server === 'exists') {
      return 'errors.organizations.exists';
    }
    if (server === 'invalid') {
      return 'platform.orgs.codeInvalid';
    }
    const check = this.codeCheck();
    if (check?.reason === 'taken') {
      return 'platform.orgs.codeTaken';
    }
    if (check?.reason === 'invalid' || (this.tried() && this.form.controls.code.invalid)) {
      return 'platform.orgs.codeInvalid';
    }
    if (check?.available) {
      return 'platform.orgs.codeFree';
    }
    return 'platform.orgs.codeHint';
  });

  constructor() {
    this.form.controls.code.valueChanges.subscribe((v) => {
      this.codeValue.set(v ?? '');
      // Префикс логина изменился — перепроверить длину полного логина.
      this.form.controls.owner.controls.login.updateValueAndValidity({ emitEvent: false });
      if (this.serverErrors()['code']) {
        this.serverErrors.update(({ code: _, ...rest }) => rest);
      }
      // Старый результат не показываем, пока не придёт ответ по новому коду.
      this.codeCheck.set(null);
      this.codeInput.next((v ?? '').trim());
    });
    // Проверка кода после паузы ввода (~400 мс); ответ по устаревшему коду отбрасывается.
    this.codeInput
      .pipe(
        debounceTime(400),
        switchMap((code) =>
          code
            ? this.api.checkCode(code).pipe(catchError(() => of<CodeCheck | null>(null)))
            : of<CodeCheck | null>(null),
        ),
      )
      .subscribe((r) => {
        if (r && r.code === this.form.controls.code.value.trim()) {
          this.codeCheck.set(r);
        }
      });
    this.form.controls.owner.controls.login.valueChanges.subscribe(() => {
      if (this.serverErrors()['login']) {
        this.serverErrors.update(({ login: _, ...rest }) => rest);
      }
    });
  }

  protected bad(c: AbstractControl): boolean {
    return this.tried() && c.invalid;
  }

  protected codeBad(): boolean {
    return (
      this.bad(this.form.controls.code) ||
      !!this.serverErrors()['code'] ||
      this.codeCheck()?.available === false
    );
  }

  protected loginBad(): boolean {
    return this.bad(this.form.controls.owner.controls.login) || !!this.serverErrors()['login'];
  }

  protected openAdd(): void {
    this.form.reset();
    this.form.controls.owner.controls.password.setValue(generatePassword());
    this.tried.set(false);
    this.serverErrors.set({});
    this.codeCheck.set(null);
    this.formOpen.set(true);
  }

  protected generate(): void {
    this.form.controls.owner.controls.password.setValue(generatePassword());
  }

  protected save(): void {
    this.tried.set(true);
    if (this.form.invalid || this.codeCheck()?.available === false) {
      this.notify.error('common.requiredTitle', 'platform.orgs.required');
      return;
    }
    const v = this.form.getRawValue();
    const code = v.code.trim();
    const draft = {
      code,
      name: v.name.trim(),
      owner: {
        name: v.owner.name.trim(),
        login: joinLogin(orgLoginPrefix(code), v.owner.login),
        password: v.owner.password,
        phone: v.owner.phone.trim(),
      },
      hotel: hotelDraft(this.form.controls.hotel),
    };
    this.saving.set(true);
    this.api.createOrganization(draft).subscribe({
      next: (org) => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.rows.update((l) => [...l, org]);
        this.handoverName.set(org.name);
        this.handover.set([
          { label: 'platform.handover.link', value: location.origin },
          { label: 'platform.owner.login', value: draft.owner.login, mono: true },
          { label: 'platform.owner.password', value: draft.owner.password, mono: true },
        ]);
        this.handoverOpen.set(true);
      },
      error: (e: unknown) => {
        this.saving.set(false);
        const code = e instanceof ApiError ? e.code : 'common.unknown';
        const fields = e instanceof ApiError ? e.fields : {};
        const errs: Record<string, string> = {};
        if (code === 'organizations.exists') {
          errs['code'] = 'exists';
        } else if (fields['code']) {
          errs['code'] = 'invalid';
        }
        if (code === 'users.loginTaken') {
          errs['login'] = 'taken';
        } else if (fields['owner.login'] === 'prefix' || fields['login'] === 'prefix') {
          errs['login'] = 'prefix';
        }
        if (code === 'settings.innInvalid' || fields['hotel.inn'] || fields['inn']) {
          errs['inn'] = 'invalid';
        }
        this.serverErrors.set(errs);
        this.notify.error('common.saveError', `errors.${code}`);
      },
    });
  }

  // ----- Передать владельцу -----
  protected readonly handoverOpen = signal(false);
  protected readonly handoverName = signal('');
  protected readonly handover = signal<CredentialRow[]>([]);

  // ----- Действия над выбранным владельцем: переименовать, сбросить пароль, блокировка -----
  protected readonly busy = signal(false);
  protected readonly renameOpen = signal(false);
  protected readonly newName = signal('');
  protected readonly resetOpen = signal(false);
  protected readonly resetting = signal<number | null>(null);
  protected readonly blockOpen = signal(false);
  protected readonly credsOpen = signal(false);
  protected readonly credsName = signal('');
  protected readonly creds = signal<CredentialRow[]>([]);

  private fail(e: unknown): void {
    this.notify.error(
      'common.saveError',
      e instanceof ApiError ? `errors.${e.code}` : 'errors.common.unknown',
    );
  }

  /** Владелец изменился — обновить строку таблицы и выбор. */
  private patchRow(saved: Organization): void {
    this.rows.update((l) => l.map((x) => (x.id === saved.id ? saved : x)));
    this.selected.set(saved);
  }

  protected openRename(): void {
    this.newName.set(this.selected()?.name ?? '');
    this.renameOpen.set(true);
  }

  protected rename(): void {
    const o = this.selected();
    const name = this.newName().trim();
    if (!o || !name) {
      return;
    }
    this.busy.set(true);
    this.api.renameOrganization(o.id, name).subscribe({
      next: (saved) => {
        this.busy.set(false);
        this.renameOpen.set(false);
        this.patchRow(saved);
        this.notify.success('common.savedTitle', 'platform.org.renamed', { name: saved.name });
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.fail(e);
      },
    });
  }

  /** PATCH /platform/organizations/{id}/active — блокирует владельца во всех его отелях. */
  protected toggleBlock(): void {
    const o = this.selected();
    if (!o) {
      return;
    }
    this.busy.set(true);
    this.api.setOrganizationActive(o.id, !o.active).subscribe({
      next: (saved) => {
        this.busy.set(false);
        this.blockOpen.set(false);
        this.patchRow(saved);
        this.notify.success(
          saved.active ? 'platform.org.unblockedTitle' : 'platform.org.blockedTitle',
          saved.active ? 'platform.org.unblockedText' : 'platform.org.blockedText',
          { name: saved.name },
        );
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.fail(e);
      },
    });
  }

  protected resetPassword(owner: OwnerShort): void {
    this.resetting.set(owner.id);
    this.api.resetPassword(owner.id).subscribe({
      next: (r) => {
        this.resetting.set(null);
        this.resetOpen.set(false);
        this.credsName.set(owner.name);
        this.creds.set([
          { label: 'platform.handover.link', value: location.origin },
          { label: 'platform.owner.login', value: owner.login, mono: true },
          { label: 'platform.owner.password', value: r.temporaryPassword ?? '', mono: true },
        ]);
        this.credsOpen.set(true);
      },
      error: (e: unknown) => {
        this.resetting.set(null);
        this.fail(e);
      },
    });
  }

  protected open(o: Organization | null): void {
    if (o) {
      void this.router.navigate(['/platform/organizations', o.id]);
    }
  }
}
