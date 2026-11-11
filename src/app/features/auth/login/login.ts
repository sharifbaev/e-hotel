import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { InputText } from 'primeng/inputtext';
import { Password } from 'primeng/password';
import { ApiError } from '../../../core/api/mock-api';
import { AuthService } from '../../../core/auth/auth.service';
import { NotifyService } from '../../../core/notify/notify.service';
import { Icon } from '../../../shared/ui/icon/icon';
import { LangSwitch } from '../../../shared/ui/lang-switch/lang-switch';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    ButtonModule,
    Checkbox,
    InputText,
    Password,
    Icon,
    LangSwitch,
  ],
  templateUrl: './login.html',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notify = inject(NotifyService);

  protected readonly form = inject(NonNullableFormBuilder).group({
    login: ['', Validators.required],
    password: ['', Validators.required],
    remember: [true],
  });

  protected readonly busy = signal(false);
  protected readonly submitted = signal(false);
  protected readonly features = ['login.feature1', 'login.feature2', 'login.feature3'];

  protected invalid(name: 'login' | 'password'): boolean {
    return this.submitted() && this.form.controls[name].invalid;
  }

  protected submit(): void {
    this.submitted.set(true);
    if (this.form.invalid) {
      this.notify.error('login.errorTitle', 'login.errorEmpty');
      return;
    }
    const { login, password, remember } = this.form.getRawValue();
    this.busy.set(true);
    this.auth.login(login, password, remember).subscribe({
      next: () => this.router.navigateByUrl(this.auth.homePath()),
      error: (e: unknown) => {
        this.busy.set(false);
        const code = e instanceof ApiError ? e.code : 'auth.invalid';
        this.notify.error('login.errorTitle', `errors.${code}`);
      },
    });
  }

  protected forgot(): void {
    this.notify.error('login.forgotTitle', 'login.forgotText');
  }
}
