import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Observable } from 'rxjs';
import { ApiError } from '../../core/api/mock-api';
import { AuthService } from '../../core/auth/auth.service';
import { PlatformService } from '../../core/data/platform.service';
import { SettingsService } from '../../core/data/settings.service';
import { HotelItem, Organization, OwnerShort } from '../../core/models';
import { NotifyService } from '../../core/notify/notify.service';
import { formatDateTime } from '../../shared/format/format';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog/confirm-dialog';
import {
  CredentialRow,
  CredentialsDialog,
} from '../../shared/ui/credentials-dialog/credentials-dialog';
import { Icon } from '../../shared/ui/icon/icon';
import { HotelFields, hotelDraft, hotelGroup } from './hotel-fields';

type Confirm = { kind: 'hotel'; hotel: HotelItem } | { kind: 'reset'; owner: OwnerShort };

/**
 * Платформа → владелец (v1.6): отели (добавить, изменить, блокировка, «Войти в отель»),
 * аккаунты владельца (сброс пароля). Переименование и блокировка владельца — в таблице «Владельцы».
 */
@Component({
  selector: 'app-platform-organization',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
    ButtonModule,
    Dialog,
    ConfirmDialog,
    CredentialsDialog,
    Icon,
    HotelFields,
  ],
  template: `
    <div
      class="mx-auto flex w-full max-w-5xl flex-col gap-5 px-6 pt-5 pb-8 max-md:px-4 max-md:pt-4"
    >
      <a
        routerLink="/platform/organizations"
        class="inline-flex w-fit items-center gap-1.5 text-sm"
      >
        <app-icon name="chevron-left" [size]="16" />
        {{ 'platform.orgs.title' | transloco }}
      </a>

      @if (org(); as o) {
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="flex flex-col gap-1">
            <div class="flex flex-wrap items-center gap-2.5">
              <h1 class="m-0 text-2xl font-bold tracking-[-0.01em] max-md:text-xl">{{ o.name }}</h1>
              <span
                class="rounded-full px-2.5 py-[3px] text-xs font-semibold"
                [class]="o.active ? 'bg-[#E7F6EC] text-[#067647]' : 'bg-[#FEE4E2] text-[#B42318]'"
                >{{ (o.active ? 'users.active' : 'users.blocked') | transloco }}</span
              >
            </div>
            <span class="text-[13px] text-muted">
              {{ 'platform.orgs.code' | transloco }}: <span class="font-mono">{{ o.code }}</span> ·
              {{ 'platform.orgs.col.createdAt' | transloco }}: {{ dt(o.createdAt) }}
            </span>
          </div>
        </div>

        <!-- Отели -->
        <section
          class="flex flex-col gap-3 rounded-[14px] border border-line bg-white p-5 max-md:p-4"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="m-0 text-[17px] font-semibold">{{ 'platform.org.hotels' | transloco }}</h2>
            <button pButton type="button" size="small" (click)="openHotel(null)">
              <app-icon name="plus" [size]="16" />
              <span pButtonLabel>{{ 'platform.org.addHotel' | transloco }}</span>
            </button>
          </div>
          @for (h of o.hotels; track h.id) {
            <div class="flex flex-wrap items-center gap-3 border-t border-line-2 pt-3">
              <span
                class="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-chip text-ink-2"
              >
                <app-icon name="building" [size]="20" [stroke]="1.8" />
              </span>
              <span class="flex min-w-0 flex-1 flex-col">
                <span class="truncate text-sm font-semibold">{{ h.name }}</span>
                <span class="text-xs text-muted"
                  >{{ h.city }} · ID {{ h.id }}
                  @if (!h.active) {
                    ·
                    <span class="font-semibold text-danger">{{
                      'hotels.blocked' | transloco
                    }}</span>
                  }
                </span>
              </span>
              <div class="flex flex-wrap gap-2">
                <button
                  pButton
                  type="button"
                  size="small"
                  severity="secondary"
                  [outlined]="true"
                  [loading]="loadingHotel() === h.id"
                  (click)="openHotel(h)"
                >
                  <app-icon name="edit" />
                  <span pButtonLabel>{{ 'common.edit' | transloco }}</span>
                </button>
                <button
                  pButton
                  type="button"
                  size="small"
                  severity="secondary"
                  [outlined]="true"
                  (click)="ask({ kind: 'hotel', hotel: h })"
                >
                  <span pButtonLabel>{{
                    (h.active ? 'users.block' : 'users.unblock') | transloco
                  }}</span>
                </button>
                <button pButton type="button" size="small" (click)="enter(h)">
                  <app-icon name="external" [size]="16" />
                  <span pButtonLabel>{{ 'platform.org.enter' | transloco }}</span>
                </button>
              </div>
            </div>
          }
        </section>

        <!-- Аккаунты владельца -->
        <section
          class="flex flex-col gap-3 rounded-[14px] border border-line bg-white p-5 max-md:p-4"
        >
          <h2 class="m-0 text-[17px] font-semibold">{{ 'platform.org.owners' | transloco }}</h2>
          @for (u of o.owners; track u.id) {
            <div class="flex flex-wrap items-center gap-3 border-t border-line-2 pt-3">
              <span class="flex min-w-0 flex-1 flex-col">
                <span class="truncate text-sm font-semibold">{{ u.name }}</span>
                <span class="text-xs text-muted"
                  >{{ u.login }}{{ u.phone ? ' · ' + u.phone : '' }} ·
                  <span [class.text-success]="u.active" [class.text-danger]="!u.active">{{
                    (u.active ? 'users.active' : 'users.blocked') | transloco
                  }}</span></span
                >
              </span>
              <button
                pButton
                type="button"
                size="small"
                severity="secondary"
                [outlined]="true"
                (click)="ask({ kind: 'reset', owner: u })"
              >
                <app-icon name="key" [size]="16" />
                <span pButtonLabel>{{ 'users.resetPassword' | transloco }}</span>
              </button>
            </div>
          } @empty {
            <p class="m-0 text-sm text-muted">{{ 'common.noData' | transloco }}</p>
          }
        </section>
      } @else if (res.isLoading()) {
        <div class="sk h-8 w-64"></div>
        <div class="sk h-40 w-full rounded-[14px]"></div>
      } @else {
        <p class="text-sm text-muted">{{ 'errors.organizations.notFound' | transloco }}</p>
      }
    </div>

    <!-- Отель: добавить / реквизиты -->
    <p-dialog
      [(visible)]="hotelOpen"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [header]="
        (editHotelId() === null ? 'platform.org.addHotel' : 'platform.org.editHotel') | transloco
      "
      [style]="{ width: '600px', maxWidth: 'calc(100vw - 32px)' }"
      styleClass="hs-dialog"
      [closeAriaLabel]="'common.close' | transloco"
    >
      <form id="hotel-form" (ngSubmit)="saveHotel()" novalidate>
        <app-hotel-fields
          [group]="hotelForm"
          [tried]="tried()"
          [innError]="innError()"
          prefix="ph"
        />
      </form>
      <ng-template #footer>
        <button
          pButton
          type="button"
          severity="secondary"
          [outlined]="true"
          (click)="hotelOpen.set(false)"
        >
          <span pButtonLabel>{{ 'common.cancel' | transloco }}</span>
        </button>
        <button pButton type="submit" form="hotel-form" [loading]="saving()">
          @if (!saving()) {
            <app-icon name="check" />
          }
          <span pButtonLabel>{{ 'common.save' | transloco }}</span>
        </button>
      </ng-template>
    </p-dialog>

    <app-confirm-dialog
      [(visible)]="confirmOpen"
      [title]="confirmText().title"
      [text]="confirmText().text"
      [params]="confirmText().params"
      [confirmLabel]="confirmText().button"
      [busy]="saving()"
      (confirm)="doConfirm()"
    />

    <app-credentials-dialog
      [(visible)]="credsOpen"
      title="platform.reset.title"
      text="platform.reset.text"
      [params]="{ name: credsName() }"
      [rows]="creds()"
    />
  `,
})
export class OrganizationPage {
  /** id владельца из адреса /platform/organizations/:id. */
  readonly id = input.required<string>();

  private readonly api = inject(PlatformService);
  private readonly settings = inject(SettingsService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotifyService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly res = rxResource({
    params: () => Number(this.id()),
    stream: ({ params }) => this.api.organization(params),
  });
  protected readonly org = linkedSignal<Organization | null>(() =>
    this.res.hasValue() ? this.res.value() : null,
  );
  protected readonly saving = signal(false);

  protected dt(v: string): string {
    return formatDateTime(v);
  }

  private fail(e: unknown): void {
    this.notify.error(
      'common.saveError',
      e instanceof ApiError ? `errors.${e.code}` : 'errors.common.unknown',
    );
  }

  /** Отель изменился — обновить его в списке владельца. */
  private patchHotel(h: HotelItem): void {
    this.org.update((o) =>
      o
        ? {
            ...o,
            hotels: o.hotels.some((x) => x.id === h.id)
              ? o.hotels.map((x) => (x.id === h.id ? h : x))
              : [...o.hotels, h],
          }
        : o,
    );
  }

  // ----- Отель: добавить / реквизиты -----
  protected readonly hotelOpen = signal(false);
  protected readonly editHotelId = signal<number | null>(null);
  protected readonly loadingHotel = signal<number | null>(null);
  protected readonly tried = signal(false);
  protected readonly innError = signal(false);
  protected readonly hotelForm = hotelGroup(this.fb);

  /**
   * Реквизиты существующего отеля подтягиваются из его настроек (GET /settings/hotel
   * с X-Hotel-Id — супер-админу доступен любой отель), чтобы PUT не стёр незаполненные поля.
   */
  protected openHotel(h: HotelItem | null): void {
    this.tried.set(false);
    this.innError.set(false);
    this.hotelForm.reset();
    this.editHotelId.set(h?.id ?? null);
    if (!h) {
      this.hotelOpen.set(true);
      return;
    }
    this.loadingHotel.set(h.id);
    this.settings.getHotel(h.id).subscribe({
      next: (s) => {
        this.loadingHotel.set(null);
        this.hotelForm.reset({
          name: s.name || h.name,
          city: s.city || h.city,
          legalName: s.legalName,
          inn: s.inn,
          phone: s.phone,
          address: s.address,
        });
        this.hotelOpen.set(true);
      },
      error: (e: unknown) => {
        this.loadingHotel.set(null);
        this.notify.error(
          'common.errorTitle',
          e instanceof ApiError ? `errors.${e.code}` : 'errors.common.unknown',
        );
      },
    });
  }

  protected saveHotel(): void {
    const o = this.org();
    this.tried.set(true);
    if (!o || this.hotelForm.invalid) {
      this.notify.error('common.requiredTitle', 'platform.hotel.required');
      return;
    }
    const draft = hotelDraft(this.hotelForm);
    const id = this.editHotelId();
    const req: Observable<HotelItem> =
      id === null ? this.api.addHotel(o.id, draft) : this.api.updateHotel(id, draft);
    this.saving.set(true);
    req.subscribe({
      next: (h) => {
        this.saving.set(false);
        this.hotelOpen.set(false);
        this.patchHotel(h);
        this.notify.success(
          id === null ? 'platform.org.hotelAddedTitle' : 'common.savedTitle',
          'platform.org.hotelSaved',
          { name: h.name },
        );
      },
      error: (e: unknown) => {
        this.saving.set(false);
        this.innError.set(e instanceof ApiError && e.code === 'settings.innInvalid');
        this.fail(e);
      },
    });
  }

  /** «Войти в отель»: работа в отеле с правами владельца (X-Hotel-Id обязателен). */
  protected enter(h: HotelItem): void {
    this.auth.switchHotel(h.id, '/');
  }

  // ----- Подтверждения: блокировка владельца / отеля, сброс пароля -----
  protected readonly confirmOpen = signal(false);
  private readonly confirmWhat = signal<Confirm | null>(null);
  protected readonly confirmText = computed(() => {
    const c = this.confirmWhat();
    if (c?.kind === 'hotel') {
      return {
        title: c.hotel.active
          ? 'platform.confirm.blockHotelTitle'
          : 'platform.confirm.unblockHotelTitle',
        text: c.hotel.active
          ? 'platform.confirm.blockHotelText'
          : 'platform.confirm.unblockHotelText',
        params: { name: c.hotel.name },
        button: c.hotel.active ? 'users.block' : 'users.unblock',
      };
    }
    return {
      title: 'platform.confirm.resetTitle',
      text: 'platform.confirm.resetText',
      params: { name: c?.kind === 'reset' ? c.owner.name : '' },
      button: 'users.resetPassword',
    };
  });

  protected ask(c: Confirm): void {
    this.confirmWhat.set(c);
    this.confirmOpen.set(true);
  }

  protected doConfirm(): void {
    const c = this.confirmWhat();
    const o = this.org();
    if (!c || !o) {
      return;
    }
    this.saving.set(true);
    const done = () => {
      this.saving.set(false);
      this.confirmOpen.set(false);
    };
    const error = (e: unknown) => {
      done();
      this.fail(e);
    };
    if (c.kind === 'hotel') {
      this.api.setHotelActive(c.hotel.id, !c.hotel.active).subscribe({
        next: (h) => {
          done();
          this.patchHotel(h);
          this.notify.success(
            h.active ? 'platform.org.unblockedTitle' : 'platform.org.blockedTitle',
            h.active ? 'platform.org.unblockedText' : 'platform.org.blockedText',
            { name: h.name },
          );
        },
        error,
      });
    } else {
      const owner = c.owner;
      this.api.resetPassword(owner.id).subscribe({
        next: (r) => {
          done();
          this.credsName.set(owner.name);
          this.creds.set([
            { label: 'platform.handover.link', value: location.origin },
            { label: 'platform.owner.login', value: owner.login, mono: true },
            {
              label: 'platform.owner.password',
              value: r.temporaryPassword ?? '',
              mono: true,
            },
          ]);
          this.credsOpen.set(true);
        },
        error,
      });
    }
  }

  // ----- Новый пароль владельца (один раз) -----
  protected readonly credsOpen = signal(false);
  protected readonly credsName = signal('');
  protected readonly creds = signal<CredentialRow[]>([]);
}
