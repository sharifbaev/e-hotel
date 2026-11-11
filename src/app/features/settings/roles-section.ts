import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { RadioButton } from 'primeng/radiobutton';
import { ApiError } from '../../core/api/mock-api';
import { RolesService } from '../../core/data/roles.service';
import { APP_SECTIONS, AppSection, Role } from '../../core/models';
import { NotifyService } from '../../core/notify/notify.service';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog/confirm-dialog';
import { Icon } from '../../shared/ui/icon/icon';
import { RoleLabelPipe } from '../../shared/ui/status/role-label.pipe';

/**
 * «Настройки → Справочники»: роли сотрудников (CRUD /roles) с доступом к разделам меню.
 * Системные роли (владелец, администратор, бухгалтер) нельзя удалить и переименовать;
 * у владельца доступ ко всем разделам всегда.
 */
@Component({
  selector: 'app-roles-section',
  imports: [
    FormsModule,
    TranslocoPipe,
    ButtonModule,
    Checkbox,
    Dialog,
    InputText,
    RadioButton,
    ConfirmDialog,
    Icon,
    RoleLabelPipe,
  ],
  template: `
    <section
      class="rise flex flex-col gap-4 rounded-[14px] border border-line bg-white p-6 max-md:p-4"
    >
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="m-0 text-[17px] font-semibold">{{ 'settings.roles.title' | transloco }}</h2>
          <p class="mt-1 mb-0 text-[13px] text-muted">
            {{ 'settings.roles.subtitle' | transloco }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            pButton
            type="button"
            severity="danger"
            [outlined]="true"
            [disabled]="!selected() || selected()!.system"
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
            [disabled]="!selected() || selected()!.code === 'owner'"
            (click)="openEdit()"
          >
            <app-icon name="edit" />
            <span pButtonLabel>{{ 'common.edit' | transloco }}</span>
          </button>
          <button pButton type="button" (click)="openAdd()">
            <app-icon name="plus" />
            <span pButtonLabel>{{ 'settings.roles.add' | transloco }}</span>
          </button>
        </div>
      </div>

      <div
        class="overflow-x-auto rounded-xl border border-line-2"
        tabindex="0"
        [attr.aria-label]="'settings.roles.title' | transloco"
      >
        <table class="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr class="border-b border-line-2 bg-subtle text-left text-xs font-semibold text-muted">
              <th scope="col" class="w-12 px-4 py-2.5">
                <span class="sr-only">{{ 'common.select' | transloco }}</span>
              </th>
              <th scope="col" class="px-3 py-2.5 font-semibold">
                {{ 'settings.roles.col.name' | transloco }}
              </th>
              <th scope="col" class="px-3 py-2.5 font-semibold">
                {{ 'settings.roles.col.sections' | transloco }}
              </th>
            </tr>
          </thead>
          <tbody>
            @if (loading()) {
              @for (s of [0, 1, 2]; track s) {
                <tr class="h-[52px] border-b border-line-2">
                  <td class="px-4"><div class="sk size-5 rounded-full"></div></td>
                  <td class="px-3"><div class="sk h-3 w-28"></div></td>
                  <td class="px-3"><div class="sk h-3 w-64"></div></td>
                </tr>
              }
            } @else {
              @for (r of items(); track r.id) {
                <tr
                  class="row-h rise min-h-[52px] cursor-pointer border-b border-line-2 last:border-b-0"
                  [class.bg-accent-tint]="selectedId() === r.id"
                  (click)="selectedId.set(r.id)"
                >
                  <td class="px-4 py-3">
                    <p-radiobutton
                      name="role-sel"
                      [value]="r.id"
                      [ngModel]="selectedId()"
                      (ngModelChange)="selectedId.set($event)"
                      [inputId]="'role-' + r.id"
                      [ariaLabel]="('common.select' | transloco) + ': ' + (r.code | roleLabel: r.name)"
                    />
                  </td>
                  <td class="px-3 py-3 font-medium whitespace-nowrap">
                    {{ r.code | roleLabel: r.name }}
                    @if (r.system) {
                      <span
                        class="ml-1.5 rounded-full bg-chip px-2 py-[2px] text-[11px] font-semibold text-muted"
                        >{{ 'settings.roles.system' | transloco }}</span
                      >
                    }
                  </td>
                  <td class="px-3 py-3 text-ink-2">
                    @if (r.code === 'owner') {
                      {{ 'settings.roles.allSections' | transloco }}
                    } @else {
                      @for (s of r.sections; track s; let last = $last) {
                        {{ 'users.sections.' + s | transloco }}{{ last ? '' : ', ' }}
                      } @empty {
                        —
                      }
                    }
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
        (editId() === null ? 'settings.roles.addTitle' : 'settings.roles.editTitle') | transloco
      "
      [style]="{ width: '520px', maxWidth: 'calc(100vw - 32px)' }"
      styleClass="hs-dialog"
      [closeAriaLabel]="'common.close' | transloco"
    >
      <form id="role-form" class="flex flex-col gap-4" (ngSubmit)="save()" novalidate>
        <div class="field">
          <label for="r-name" class="field-label"
            >{{ 'settings.roles.form.name' | transloco }} <span class="req">*</span></label
          >
          @if (editSystem()) {
            <input id="r-name" pInputText [value]="editCode() | roleLabel" disabled />
            <span class="hint">{{ 'settings.roles.form.systemHint' | transloco }}</span>
          } @else {
            <input
              id="r-name"
              name="name"
              pInputText
              [ngModel]="name()"
              (ngModelChange)="name.set($event)"
              [placeholder]="'settings.roles.form.namePlaceholder' | transloco"
              [invalid]="nameInvalid()"
              [attr.aria-invalid]="nameInvalid()"
            />
          }
        </div>
        <fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
          <legend class="field-label mb-1.5">
            {{ 'settings.roles.form.sections' | transloco }} <span class="req">*</span>
          </legend>
          <div class="grid grid-cols-2 gap-x-4 gap-y-1 max-sm:grid-cols-1">
            @for (s of allSections; track s) {
              <label
                class="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm text-ink-2"
                [for]="'rs-' + s"
              >
                <p-checkbox
                  [inputId]="'rs-' + s"
                  [binary]="true"
                  [ngModel]="sections().includes(s)"
                  (ngModelChange)="toggle(s, $event)"
                  [ngModelOptions]="{ standalone: true }"
                />
                {{ 'users.sections.' + s | transloco }}
              </label>
            }
          </div>
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
        <button pButton type="submit" form="role-form" [loading]="saving()">
          @if (!saving()) {
            <app-icon name="check" />
          }
          <span pButtonLabel>{{ 'common.save' | transloco }}</span>
        </button>
      </ng-template>
    </p-dialog>

    <app-confirm-dialog
      [(visible)]="confirmOpen"
      title="settings.roles.confirmTitle"
      text="settings.roles.confirmText"
      [params]="{ name: selected()?.name ?? '' }"
      [busy]="saving()"
      (confirm)="remove()"
    />
  `,
})
export class RolesSection {
  private readonly api = inject(RolesService);
  private readonly notify = inject(NotifyService);

  protected readonly allSections = APP_SECTIONS;

  private readonly res = rxResource({ stream: () => this.api.list() });
  protected readonly items = linkedSignal<Role[]>(() =>
    this.res.hasValue() ? this.res.value() : [],
  );
  protected readonly loading = computed(() => this.res.isLoading());
  protected readonly selectedId = signal<number | null>(null);
  protected readonly selected = computed(
    () => this.items().find((r) => r.id === this.selectedId()) ?? null,
  );

  protected readonly formOpen = signal(false);
  protected readonly editId = signal<number | null>(null);
  protected readonly editCode = signal('');
  protected readonly editSystem = signal(false);
  protected readonly name = signal('');
  protected readonly sections = signal<AppSection[]>([]);
  protected readonly tried = signal(false);
  protected readonly saving = signal(false);
  protected readonly confirmOpen = signal(false);
  protected readonly nameInvalid = computed(() => this.tried() && !this.name().trim());

  protected toggle(s: AppSection, on: boolean): void {
    this.sections.update((l) =>
      on ? APP_SECTIONS.filter((x) => x === s || l.includes(x)) : l.filter((x) => x !== s),
    );
  }

  protected openAdd(): void {
    this.editId.set(null);
    this.editCode.set('');
    this.editSystem.set(false);
    this.name.set('');
    this.sections.set([]);
    this.tried.set(false);
    this.formOpen.set(true);
  }

  protected openEdit(): void {
    const r = this.selected();
    if (!r || r.code === 'owner') {
      return;
    }
    this.editId.set(r.id);
    this.editCode.set(r.code);
    this.editSystem.set(r.system);
    this.name.set(r.name);
    this.sections.set([...r.sections]);
    this.tried.set(false);
    this.formOpen.set(true);
  }

  protected save(): void {
    this.tried.set(true);
    if ((!this.editSystem() && !this.name().trim()) || !this.sections().length) {
      this.notify.error('common.requiredTitle', 'settings.roles.toast.required');
      return;
    }
    const id = this.editId();
    const draft = { name: this.name(), sections: this.sections() };
    this.saving.set(true);
    const req = id === null ? this.api.create(draft) : this.api.update(id, draft);
    req.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.items.update((l) =>
          id === null ? [...l, saved] : l.map((r) => (r.id === id ? saved : r)),
        );
        this.selectedId.set(saved.id);
        this.notify.success(
          id === null ? 'settings.roles.toast.addedTitle' : 'common.savedTitle',
          id === null ? 'settings.roles.toast.addedText' : 'settings.roles.toast.updatedText',
          { name: saved.name },
        );
      },
      error: (e: unknown) => {
        this.saving.set(false);
        if (e instanceof ApiError && e.code === 'roles.exists') {
          this.notify.error('common.saveError', 'settings.roles.toast.exists', {
            name: draft.name.trim(),
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

  protected remove(): void {
    const r = this.selected();
    if (!r || r.system) {
      return;
    }
    this.saving.set(true);
    this.api.remove(r.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.confirmOpen.set(false);
        this.items.update((l) => l.filter((x) => x.id !== r.id));
        this.selectedId.set(null);
        this.notify.success('settings.roles.toast.deletedTitle', 'settings.roles.toast.deletedText', {
          name: r.name,
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
