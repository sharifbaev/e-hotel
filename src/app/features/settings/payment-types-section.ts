import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { RadioButton } from 'primeng/radiobutton';
import { ApiError } from '../../core/api/mock-api';
import { PaymentTypesService } from '../../core/data/payment-types.service';
import { PaymentTypeItem } from '../../core/models';
import { NotifyService } from '../../core/notify/notify.service';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog/confirm-dialog';
import { Icon } from '../../shared/ui/icon/icon';
import { PayLabelPipe } from '../../shared/format/pay-label.pipe';

/** «Настройки → Справочники»: справочник «Тип оплаты» (CRUD /payment-types). Системные типы только для чтения. */
@Component({
  selector: 'app-payment-types-section',
  imports: [PayLabelPipe, FormsModule, TranslocoPipe, ButtonModule, Dialog, InputText, RadioButton, ConfirmDialog, Icon],
  template: `
    <section
      class="rise flex flex-col gap-4 rounded-[14px] border border-line bg-white p-6 max-md:p-4"
    >
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="m-0 text-[17px] font-semibold">
            {{ 'settings.paymentTypes.title' | transloco }}
          </h2>
          <p class="mt-1 mb-0 text-[13px] text-muted">
            {{ 'settings.paymentTypes.subtitle' | transloco }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            pButton
            type="button"
            severity="danger"
            [outlined]="true"
            [disabled]="!editable()"
            (click)="confirmOpen.set(true)"
          >
            <app-icon name="trash" />
            <span pButtonLabel>{{ 'common.delete' | transloco }}</span>
          </button>
          <button
            pButton
            type="button"
            severity="secondary"
            [outlined]="true"
            [disabled]="!editable()"
            (click)="openEdit()"
          >
            <app-icon name="edit" />
            <span pButtonLabel>{{ 'common.edit' | transloco }}</span>
          </button>
          <button pButton type="button" (click)="openAdd()">
            <app-icon name="plus" />
            <span pButtonLabel>{{ 'settings.paymentTypes.add' | transloco }}</span>
          </button>
        </div>
      </div>

      <div
        class="overflow-x-auto rounded-xl border border-line-2"
        tabindex="0"
        [attr.aria-label]="'settings.paymentTypes.title' | transloco"
      >
        <table class="w-full min-w-[360px] border-collapse text-sm">
          <thead>
            <tr class="border-b border-line-2 bg-subtle text-left text-xs font-semibold text-muted">
              <th scope="col" class="w-12 px-4 py-2.5">
                <span class="sr-only">{{ 'common.select' | transloco }}</span>
              </th>
              <th scope="col" class="px-3 py-2.5 font-semibold">
                {{ 'settings.paymentTypes.col.name' | transloco }}
              </th>
            </tr>
          </thead>
          <tbody>
            @if (loading()) {
              @for (s of [0, 1, 2]; track s) {
                <tr class="h-[52px] border-b border-line-2">
                  <td class="px-4"><div class="sk size-5 rounded-full"></div></td>
                  <td class="px-3"><div class="sk h-3 w-40"></div></td>
                </tr>
              }
            } @else {
              @for (t of items(); track t.id) {
                <tr
                  class="row-h rise h-[52px] cursor-pointer border-b border-line-2 last:border-b-0"
                  [class.bg-accent-tint]="selectedId() === t.id"
                  (click)="selectedId.set(t.id)"
                >
                  <td class="px-4">
                    <p-radiobutton
                      name="ptype-sel"
                      [value]="t.id"
                      [ngModel]="selectedId()"
                      (ngModelChange)="selectedId.set($event)"
                      [inputId]="'ptype-' + t.id"
                      [ariaLabel]="('common.select' | transloco) + ': ' + (t.code | payLabel)"
                    />
                  </td>
                  <td class="px-3 font-medium">
                    {{ t.code | payLabel }}
                    @if (t.system) {
                      <span class="ml-2 text-xs font-normal text-muted">{{
                        'settings.paymentTypes.system' | transloco
                      }}</span>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="2" class="px-4 py-10 text-center">
                    <span class="block text-[15px] font-semibold">{{
                      'common.noData' | transloco
                    }}</span>
                    <span class="text-[13px] text-muted">{{
                      'settings.paymentTypes.empty' | transloco
                    }}</span>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    </section>

    <p-dialog
      [(visible)]="formOpen"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [header]="
        (editId() === null ? 'settings.paymentTypes.addTitle' : 'settings.paymentTypes.editTitle')
          | transloco
      "
      [style]="{ width: '440px', maxWidth: 'calc(100vw - 32px)' }"
      styleClass="hs-dialog"
      [closeAriaLabel]="'common.close' | transloco"
    >
      <form id="ptype-form" class="flex flex-col gap-4" (ngSubmit)="save()" novalidate>
        <div class="field">
          <label for="pt-name" class="field-label"
            >{{ 'settings.paymentTypes.form.name' | transloco }} <span class="req">*</span></label
          >
          <input
            id="pt-name"
            name="name"
            pInputText
            [ngModel]="name()"
            (ngModelChange)="name.set($event)"
            [placeholder]="'settings.paymentTypes.form.namePlaceholder' | transloco"
            [invalid]="nameInvalid()"
            [attr.aria-invalid]="nameInvalid()"
          />
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
        <button pButton type="submit" form="ptype-form" [loading]="saving()">
          @if (!saving()) {
            <app-icon name="check" />
          }
          <span pButtonLabel>{{ 'common.save' | transloco }}</span>
        </button>
      </ng-template>
    </p-dialog>

    <app-confirm-dialog
      [(visible)]="confirmOpen"
      title="settings.paymentTypes.confirmTitle"
      text="settings.paymentTypes.confirmText"
      [params]="{ name: selected()?.name ?? '' }"
      [busy]="saving()"
      (confirm)="remove()"
    />
  `,
})
export class PaymentTypesSection {
  private readonly api = inject(PaymentTypesService);
  private readonly notify = inject(NotifyService);

  private readonly res = rxResource({ stream: () => this.api.list() });
  /** Системные типы (наличные, карты, перечисление, не оплачено) не меняются и не удаляются. */
  protected readonly editable = computed(() => !!this.selected() && !this.selected()!.system);
  protected readonly items = linkedSignal<PaymentTypeItem[]>(() =>
    this.res.hasValue() ? this.res.value() : [],
  );
  protected readonly loading = computed(() => this.res.isLoading());
  protected readonly selectedId = signal<number | null>(null);
  protected readonly selected = computed(
    () => this.items().find((t) => t.id === this.selectedId()) ?? null,
  );

  protected readonly formOpen = signal(false);
  protected readonly editId = signal<number | null>(null);
  protected readonly name = signal('');
  protected readonly tried = signal(false);
  protected readonly saving = signal(false);
  protected readonly confirmOpen = signal(false);
  protected readonly nameInvalid = computed(() => this.tried() && !this.name().trim());

  protected openAdd(): void {
    this.editId.set(null);
    this.name.set('');
    this.tried.set(false);
    this.formOpen.set(true);
  }

  protected openEdit(): void {
    const t = this.selected();
    if (!t) {
      return;
    }
    this.editId.set(t.id);
    this.name.set(t.name);
    this.tried.set(false);
    this.formOpen.set(true);
  }

  protected save(): void {
    this.tried.set(true);
    const name = this.name().trim();
    if (!name) {
      this.notify.error('common.requiredTitle', 'settings.paymentTypes.toast.required');
      return;
    }
    const id = this.editId();
    this.saving.set(true);
    this.api.save(name, id).subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.items.update((l) =>
          id === null ? [...l, saved] : l.map((t) => (t.id === id ? saved : t)),
        );
        this.selectedId.set(saved.id);
        this.notify.success(
          id === null ? 'settings.paymentTypes.toast.addedTitle' : 'common.savedTitle',
          id === null
            ? 'settings.paymentTypes.toast.addedText'
            : 'settings.paymentTypes.toast.updatedText',
          { name: saved.name },
        );
      },
      error: (e: unknown) => {
        this.saving.set(false);
        if (e instanceof ApiError && e.code === 'paymentTypes.exists') {
          this.notify.error('common.saveError', 'settings.paymentTypes.toast.exists', { name });
        } else {
          this.notify.error(
            'common.saveError',
            e instanceof ApiError ? `errors.${e.code}` : 'errors.common.unknown',
          );
        }
      },
    });
  }

  protected remove(): void {
    const t = this.selected();
    if (!t) {
      return;
    }
    this.saving.set(true);
    this.api.remove(t.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.confirmOpen.set(false);
        this.items.update((l) => l.filter((x) => x.id !== t.id));
        this.selectedId.set(null);
        this.notify.success(
          'settings.paymentTypes.toast.deletedTitle',
          'settings.paymentTypes.toast.deletedText',
          { name: t.name },
        );
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
