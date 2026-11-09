import { Component, effect, inject, input, model, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { ApiError } from '../../core/api/mock-api';
import { BlacklistService } from '../../core/data/blacklist.service';
import { GuestsService } from '../../core/data/guests.service';
import { MOCK_COUNTRIES } from '../../core/mocks/mock-data';
import { BlacklistDraft, BlacklistEntry } from '../../core/models';
import { NotifyService } from '../../core/notify/notify.service';
import { formatDocInput } from '../../shared/format/format';
import { Icon } from '../../shared/ui/icon/icon';

/** Гость, которого добавляют в ЧС из книги или архива (данные уже известны). */
export type BlacklistPerson = Omit<BlacklistDraft, 'reason'>;

let dialogSeq = 0;

/**
 * Добавление в чёрный список. С `person` — только причина (из «Книги» / «Гостей»),
 * без него — ручной ввод по документу с поиском в архиве (страница ЧС).
 */
@Component({
  selector: 'app-blacklist-dialog',
  imports: [ReactiveFormsModule, TranslocoPipe, ButtonModule, Dialog, InputText, Select, Textarea, Icon],
  template: `
    <p-dialog
      [(visible)]="visible"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [header]="'blacklist.addTitle' | transloco"
      [style]="{ width: person() ? '460px' : '600px', maxWidth: 'calc(100vw - 32px)' }"
      styleClass="hs-dialog"
      [closeAriaLabel]="'common.close' | transloco"
    >
      <form
        [formGroup]="form"
        [id]="uid + 'form'"
        (ngSubmit)="save()"
        novalidate
        class="flex flex-col gap-4"
      >
        @if (person(); as p) {
          <div class="flex items-center gap-3 rounded-xl border border-danger-line bg-danger-soft p-3.5">
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-full bg-danger text-white"
              aria-hidden="true"
            >
              <app-icon name="ban" [size]="20" [stroke]="2" />
            </span>
            <span class="flex min-w-0 flex-col gap-0.5">
              <span class="truncate text-[15px] font-semibold text-ink"
                >{{ p.lastName }} {{ p.firstName }} {{ p.middleName }}</span
              >
              <span class="text-[13px] text-muted"
                >{{ p.doc }} · {{ 'countries.' + p.country | transloco }}</span
              >
            </span>
          </div>
        } @else {
          <div class="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            <div class="field col-span-full">
              <label [attr.for]="uid + 'doc'" class="field-label"
                >{{ 'guests.reg.docNumber' | transloco }} <span class="req">*</span></label
              >
              <div class="flex gap-2">
                <input
                  [id]="uid + 'doc'"
                  pInputText
                  formControlName="doc"
                  placeholder="AB 1234567"
                  class="min-w-0 flex-1 uppercase"
                  autocomplete="off"
                  (input)="fixDoc()"
                  (keydown.enter)="$event.preventDefault(); lookup()"
                  [invalid]="bad('doc')"
                  [attr.aria-invalid]="bad('doc')"
                  [attr.aria-describedby]="uid + 'doc-hint'"
                />
                <button
                  pButton
                  type="button"
                  severity="secondary"
                  [outlined]="true"
                  class="w-11 shrink-0 !px-0"
                  [attr.aria-label]="'guests.reg.lookup' | transloco"
                  [title]="'guests.reg.lookup' | transloco"
                  [disabled]="searching()"
                  (click)="lookup()"
                >
                  <app-icon [name]="searching() ? 'spinner' : 'search'" [stroke]="2.2" />
                </button>
              </div>
              <span [id]="uid + 'doc-hint'" class="hint">{{
                'guests.reg.lookupHint' | transloco
              }}</span>
            </div>
            <div class="field">
              <label [attr.for]="uid + 'last'" class="field-label"
                >{{ 'guests.reg.lastName' | transloco }} <span class="req">*</span></label
              >
              <input
                [id]="uid + 'last'"
                pInputText
                formControlName="lastName"
                [invalid]="bad('lastName')"
                [attr.aria-invalid]="bad('lastName')"
              />
            </div>
            <div class="field">
              <label [attr.for]="uid + 'first'" class="field-label"
                >{{ 'guests.reg.firstName' | transloco }} <span class="req">*</span></label
              >
              <input
                [id]="uid + 'first'"
                pInputText
                formControlName="firstName"
                [invalid]="bad('firstName')"
                [attr.aria-invalid]="bad('firstName')"
              />
            </div>
            <div class="field">
              <label [attr.for]="uid + 'mid'" class="field-label">{{
                'guests.reg.middleName' | transloco
              }}</label>
              <input [id]="uid + 'mid'" pInputText formControlName="middleName" />
            </div>
            <div class="field">
              <label [attr.for]="uid + 'country'" class="field-label">{{
                'guests.reg.country' | transloco
              }}</label>
              <p-select
                [inputId]="uid + 'country'"
                formControlName="country"
                [options]="countries"
                [filter]="true"
                appendTo="body"
                [fluid]="true"
              >
                <ng-template #selectedItem let-c>{{ 'countries.' + c | transloco }}</ng-template>
                <ng-template #item let-c>{{ 'countries.' + c | transloco }}</ng-template>
              </p-select>
            </div>
          </div>
        }
        <div class="field">
          <label [attr.for]="uid + 'reason'" class="field-label"
            >{{ 'blacklist.reason' | transloco }} <span class="req">*</span></label
          >
          <textarea
            [id]="uid + 'reason'"
            pTextarea
            rows="3"
            class="w-full resize-none"
            formControlName="reason"
            [placeholder]="'blacklist.reasonPlaceholder' | transloco"
            [invalid]="bad('reason')"
            [attr.aria-invalid]="bad('reason')"
          ></textarea>
        </div>
      </form>
      <ng-template #footer>
        <button pButton type="button" severity="secondary" [outlined]="true" (click)="visible.set(false)">
          <span pButtonLabel>{{ 'common.cancel' | transloco }}</span>
        </button>
        <button pButton type="submit" severity="danger" [attr.form]="uid + 'form'" [loading]="saving()">
          @if (!saving()) {
            <app-icon name="ban" />
          }
          <span pButtonLabel>{{ 'blacklist.addSubmit' | transloco }}</span>
        </button>
      </ng-template>
    </p-dialog>
  `,
})
export class BlacklistDialog {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly blacklist = inject(BlacklistService);
  private readonly guests = inject(GuestsService);
  private readonly notify = inject(NotifyService);

  readonly visible = model(false);
  /** Гость из книги / архива; null — ручной ввод. */
  readonly person = input<BlacklistPerson | null>(null);
  readonly added = output<BlacklistEntry>();

  protected readonly uid = `bl${++dialogSeq}-`;
  protected readonly countries = MOCK_COUNTRIES;
  protected readonly tried = signal(false);
  protected readonly saving = signal(false);
  protected readonly searching = signal(false);

  protected readonly form = this.fb.group({
    doc: ['', Validators.required],
    lastName: ['', Validators.required],
    firstName: ['', Validators.required],
    middleName: [''],
    country: ['UZ'],
    reason: ['', [Validators.required, Validators.pattern(/\S/)]],
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        const p = this.person();
        this.tried.set(false);
        this.form.reset({
          doc: p?.doc ?? '',
          lastName: p?.lastName ?? '',
          firstName: p?.firstName ?? '',
          middleName: p?.middleName ?? '',
          country: p?.country ?? 'UZ',
          reason: '',
        });
      }
    });
  }

  protected bad(name: 'doc' | 'lastName' | 'firstName' | 'reason'): boolean {
    return this.tried() && this.form.controls[name].invalid;
  }

  protected fixDoc(): void {
    const c = this.form.controls.doc;
    const v = formatDocInput(c.value);
    if (v !== c.value) {
      c.setValue(v, { emitEvent: false });
    }
  }

  protected lookup(): void {
    const doc = this.form.controls.doc.value.trim();
    if (!doc) {
      this.notify.error('guests.reg.lookupEmptyTitle', 'guests.reg.lookupEmptyText');
      return;
    }
    this.searching.set(true);
    this.guests.lookupByDoc(doc).subscribe({
      next: (p) => {
        this.searching.set(false);
        this.form.patchValue({
          doc: p.doc,
          lastName: p.lastName,
          firstName: p.firstName,
          middleName: p.middleName,
          country: p.country,
        });
        this.notify.success('guests.reg.foundTitle', 'blacklist.foundText', {
          name: `${p.lastName} ${p.firstName}`,
        });
      },
      error: () => {
        this.searching.set(false);
        this.notify.error('guests.reg.notFoundTitle', 'guests.reg.notFoundText', { doc });
      },
    });
  }

  protected save(): void {
    this.tried.set(true);
    if (this.form.invalid) {
      this.notify.error('common.requiredTitle', 'blacklist.toast.required');
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.blacklist
      .add({
        doc: v.doc.trim(),
        lastName: v.lastName.trim(),
        firstName: v.firstName.trim(),
        middleName: v.middleName.trim(),
        country: v.country,
        reason: v.reason,
      })
      .subscribe({
        next: (e) => {
          this.saving.set(false);
          this.visible.set(false);
          this.notify.success('blacklist.toast.addedTitle', 'blacklist.toast.addedText', {
            name: `${e.lastName} ${e.firstName}`,
          });
          this.added.emit(e);
        },
        error: (e: unknown) => {
          this.saving.set(false);
          if (e instanceof ApiError && e.code === 'blacklist.exists') {
            this.notify.error('blacklist.toast.existsTitle', 'blacklist.toast.existsText', {
              doc: v.doc.trim(),
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
}
