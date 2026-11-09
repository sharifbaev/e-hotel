import { Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { ApiError } from '../../../core/api/mock-api';
import { AuthService } from '../../../core/auth/auth.service';
import { NotifyService } from '../../../core/notify/notify.service';
import { Icon } from '../icon/icon';

type PasswordField = 'oldPassword' | 'newPassword' | 'repeat';

/**
 * Обязательная смена пароля: администратор сбросил пароль (CurrentUser.mustChangePassword),
 * сотрудник вошёл временным паролем и должен задать свой. Окно нельзя закрыть — только выйти.
 */
@Component({
  selector: 'app-change-password-dialog',
  imports: [ReactiveFormsModule, TranslocoPipe, ButtonModule, Dialog, InputText, Icon],
  template: `
    <p-dialog
      [visible]="open()"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [closable]="false"
      [closeOnEscape]="false"
      [header]="'password.title' | transloco"
      [style]="{ width: '420px', maxWidth: 'calc(100vw - 32px)' }"
    >
      <form class="flex flex-col gap-4" [formGroup]="form" (ngSubmit)="save()">
        <p class="m-0 text-sm leading-normal text-muted">{{ 'password.text' | transloco }}</p>
        <label class="flex flex-col gap-1.5 text-sm font-medium">
          {{ 'password.old' | transloco }}
          <span class="relative flex">
            <input
              pInputText
              class="w-full pr-11"
              [type]="shown()['oldPassword'] ? 'text' : 'password'"
              autocomplete="current-password"
              formControlName="oldPassword"
              [class.ng-dirty]="tried()"
              [attr.aria-invalid]="tried() && form.controls.oldPassword.invalid"
            />
            <button
              type="button"
              class="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
              [attr.aria-label]="
                (shown()['oldPassword'] ? 'password.hide' : 'password.show') | transloco
              "
              [attr.aria-pressed]="shown()['oldPassword']"
              (click)="toggle('oldPassword')"
            >
              <app-icon [name]="shown()['oldPassword'] ? 'eye-off' : 'eye'" [size]="18" />
            </button>
          </span>
        </label>
        <label class="flex flex-col gap-1.5 text-sm font-medium">
          {{ 'password.new' | transloco }}
          <span class="relative flex">
            <input
              pInputText
              class="w-full pr-11"
              [type]="shown()['newPassword'] ? 'text' : 'password'"
              autocomplete="new-password"
              formControlName="newPassword"
              [class.ng-dirty]="tried()"
              [attr.aria-invalid]="tried() && form.controls.newPassword.invalid"
            />
            <button
              type="button"
              class="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
              [attr.aria-label]="
                (shown()['newPassword'] ? 'password.hide' : 'password.show') | transloco
              "
              [attr.aria-pressed]="shown()['newPassword']"
              (click)="toggle('newPassword')"
            >
              <app-icon [name]="shown()['newPassword'] ? 'eye-off' : 'eye'" [size]="18" />
            </button>
          </span>
          <span class="text-xs font-normal text-muted">{{ 'password.hint' | transloco }}</span>
        </label>
        <label class="flex flex-col gap-1.5 text-sm font-medium">
          {{ 'password.repeat' | transloco }}
          <span class="relative flex">
            <input
              pInputText
              class="w-full pr-11"
              [type]="shown()['repeat'] ? 'text' : 'password'"
              autocomplete="new-password"
              formControlName="repeat"
              [class.ng-dirty]="tried()"
              [attr.aria-invalid]="tried() && mismatch()"
            />
            <button
              type="button"
              class="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
              [attr.aria-label]="
                (shown()['repeat'] ? 'password.hide' : 'password.show') | transloco
              "
              [attr.aria-pressed]="shown()['repeat']"
              (click)="toggle('repeat')"
            >
              <app-icon [name]="shown()['repeat'] ? 'eye-off' : 'eye'" [size]="18" />
            </button>
          </span>
        </label>
        <div class="flex gap-2.5 pt-1">
          <button
            pButton
            type="button"
            severity="secondary"
            [outlined]="true"
            class="flex-1"
            [disabled]="saving()"
            (click)="logout()"
          >
            <span pButtonLabel>{{ 'shell.logout' | transloco }}</span>
          </button>
          <button pButton type="submit" class="flex-1" [loading]="saving()">
            <span pButtonLabel>{{ 'common.save' | transloco }}</span>
          </button>
        </div>
      </form>
    </p-dialog>
  `,
})
export class ChangePasswordDialog {
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotifyService);

  protected readonly open = computed(() => !!this.auth.user()?.mustChangePassword);
  /** Какие поля показаны открытым текстом (кнопка с глазом). */
  protected readonly shown = signal<Record<PasswordField, boolean>>({
    oldPassword: false,
    newPassword: false,
    repeat: false,
  });
  protected readonly saving = signal(false);
  protected readonly tried = signal(false);
  protected readonly form = inject(NonNullableFormBuilder).group({
    oldPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    repeat: ['', Validators.required],
  });

  protected toggle(field: PasswordField): void {
    this.shown.update((s) => ({ ...s, [field]: !s[field] }));
  }

  protected mismatch(): boolean {
    const v = this.form.getRawValue();
    return v.newPassword !== v.repeat;
  }

  protected save(): void {
    this.tried.set(true);
    if (this.form.invalid) {
      this.notify.error('password.errorTitle', 'password.errorShort');
      return;
    }
    if (this.mismatch()) {
      this.notify.error('password.errorTitle', 'password.errorMismatch');
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.auth.changePassword(v.oldPassword, v.newPassword).subscribe({
      next: () => {
        this.saving.set(false);
        this.form.reset();
        this.tried.set(false);
        this.notify.success('password.doneTitle', 'password.doneText');
      },
      error: (e: unknown) => {
        this.saving.set(false);
        this.notify.error(
          'password.errorTitle',
          e instanceof ApiError && e.code === 'validation.failed'
            ? 'password.errorWrong'
            : e instanceof ApiError
              ? `errors.${e.code}`
              : 'errors.common.unknown',
        );
      },
    });
  }

  protected logout(): void {
    this.auth.logout();
    location.assign('/login');
  }
}
