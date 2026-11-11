import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import {
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ColDef } from 'ag-grid-community';
import { ButtonModule } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { RadioButton } from 'primeng/radiobutton';
import { Select } from 'primeng/select';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { map, startWith } from 'rxjs';
import { ApiError } from '../../core/api/mock-api';
import { SettingsService } from '../../core/data/settings.service';
import { LanguageService } from '../../core/i18n/language.service';
import { ActionLogEntry, LogAction, HotelSettings, Lang, RoomCategory } from '../../core/models';
import { NotifyService } from '../../core/notify/notify.service';
import { formatDateTime, formatSum } from '../../shared/format/format';
import { SumPipe } from '../../shared/format/format.pipes';
import { SumInputDirective } from '../../shared/forms/sum-input.directive';
import { avatarCell } from '../../shared/grid/cells';
import { DataGrid } from '../../shared/grid/data-grid';
import { dateFilter, staffFilter } from '../../shared/grid/grid-filters';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog/confirm-dialog';
import { Icon } from '../../shared/ui/icon/icon';
import { RolesSection } from './roles-section';
import { ServiceTypesSection } from './service-types-section';

type SettingsTab = 'hotel' | 'rates' | 'log';

const LOG_TONE: Record<LogAction, { glyph: string; bg: string; fg: string }> = {
  checkin: { glyph: '+', bg: '#E7F6EC', fg: '#067647' },
  checkout: { glyph: '↗', bg: '#F2F4F7', fg: '#344054' },
  ready: { glyph: '✓', bg: '#FBF0E6', fg: '#8A4A14' },
  bookingEdit: { glyph: '✎', bg: '#DCE7FD', fg: '#1E3A8A' },
  tariffEdit: { glyph: '✎', bg: '#DCE7FD', fg: '#1E3A8A' },
  expense: { glyph: '−', bg: '#FEECEB', fg: '#B42318' },
  block: { glyph: '×', bg: '#F2F4F7', fg: '#344054' },
};

@Component({
  selector: 'app-settings',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    TranslocoPipe,
    ButtonModule,
    DatePicker,
    Dialog,
    InputText,
    RadioButton,
    Select,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    ConfirmDialog,
    DataGrid,
    Icon,
    SumInputDirective,
    SumPipe,
    RolesSection,
    ServiceTypesSection,
  ],
  templateUrl: './settings.html',
})
export class SettingsPage {
  private readonly api = inject(SettingsService);
  private readonly notify = inject(NotifyService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly transloco = inject(TranslocoService);
  private readonly lang = inject(LanguageService);

  protected readonly tab = signal<SettingsTab>('hotel');
  protected readonly saving = signal(false);

  // ===== Отель =====
  protected readonly langs: Lang[] = ['ru', 'uz-Latn', 'uz-Cyrl'];
  protected readonly hotelForm = this.fb.group({
    name: ['', Validators.required],
    legalName: [''],
    inn: ['', Validators.pattern(/^(\d{9})?$/)],
    phone: [''],
    city: [''],
    address: [''],
    checkinTime: this.fb.control<Date | null>(null),
    checkoutTime: this.fb.control<Date | null>(null),
    defaultLang: this.fb.control<Lang>('ru'),
    currency: [{ value: 'UZS', disabled: true }],
  });
  private initialHotel: HotelSettings | null = null;
  protected readonly hotelLoading = signal(true);

  protected readonly dirty = toSignal(
    this.hotelForm.valueChanges.pipe(
      map(() => this.hotelForm.dirty),
      startWith(false),
    ),
    { initialValue: false },
  );

  // ===== Категории =====
  private readonly catRes = rxResource({ stream: () => this.api.listCategories() });
  protected readonly categories = linkedSignal<RoomCategory[]>(() =>
    this.catRes.hasValue() ? this.catRes.value() : [],
  );
  protected readonly catLoading = computed(() => this.catRes.isLoading());
  protected readonly selectedCatId = signal<number | null>(null);
  protected readonly selectedCat = computed(
    () => this.categories().find((c) => c.id === this.selectedCatId()) ?? null,
  );
  protected readonly catFormOpen = signal(false);
  protected readonly catEditId = signal<number | null>(null);
  protected readonly catTried = signal(false);
  protected readonly confirmOpen = signal(false);
  protected readonly catForm = this.fb.group({
    name: ['', Validators.required],
    rooms: this.fb.control<number | null>(null),
    beds: [''],
    price: this.fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
  });

  // ===== Журнал (таблица: фильтры по столбцам — сотрудник, действие, период) =====
  private readonly logRes = rxResource({
    stream: () => this.api.log(),
  });
  protected readonly log = computed(() => (this.logRes.hasValue() ? this.logRes.value() : []));
  protected readonly logLoading = computed(() => this.logRes.isLoading());
  protected readonly logRowId = (p: { data: ActionLogEntry }) => String(p.data.id);

  /** Текст события на текущем языке («Заселил гостя Lena Hoffmann в номер 302»). */
  private logText(l: ActionLogEntry): string {
    const text = this.transloco.translate(`settings.log.actions.${l.action}`, l.params);
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  protected readonly logColumns = computed<ColDef<ActionLogEntry>[]>(() => {
    this.lang.current();
    const t = (k: string) => this.transloco.translate(k);
    return [
      {
        field: 'who',
        headerName: t('settings.log.col.who'),
        flex: 1.3,
        minWidth: 200,
        cellRenderer: (p: { value: string }) => avatarCell(p.value, { size: 28 }),
        ...staffFilter<ActionLogEntry>(() => this.api.logAuthors()),
      },
      {
        colId: 'action',
        headerName: t('settings.log.col.action'),
        flex: 2.6,
        minWidth: 300,
        valueGetter: (p) => (p.data ? this.logText(p.data) : ''),
        cellRenderer: (p: { value: string; data?: ActionLogEntry }) =>
          p.data ? logActionCell(LOG_TONE[p.data.action], p.value) : '',
      },
      {
        field: 'at',
        headerName: t('settings.log.col.at'),
        flex: 1.1,
        minWidth: 170,
        sort: 'desc',
        valueFormatter: (p) => formatDateTime(p.value),
        ...dateFilter<ActionLogEntry>(),
      },
    ];
  });

  constructor() {
    this.api.getHotel().subscribe({
      next: (h) => {
        this.initialHotel = h;
        this.hotelForm.reset(toForm(h));
        this.hotelLoading.set(false);
      },
      error: (e: unknown) => {
        this.hotelLoading.set(false);
        this.notify.error('common.errorTitle', e instanceof ApiError ? `errors.${e.code}` : 'errors.common.unknown');
      },
    });
  }

  protected setTab(value: string | number | undefined): void {
    if (value === 'hotel' || value === 'rates' || value === 'log') {
      this.tab.set(value);
    }
  }

  // ----- Отель -----
  protected discard(): void {
    if (this.initialHotel) {
      this.hotelForm.reset(toForm(this.initialHotel));
    }
  }

  protected saveHotel(): void {
    if (this.hotelForm.invalid) {
      this.tab.set('hotel');
      this.notify.error('settings.toast.innTitle', 'settings.toast.innText');
      return;
    }
    const v = this.hotelForm.getRawValue();
    const data: HotelSettings = {
      ...v,
      checkinTime: timeToString(v.checkinTime),
      checkoutTime: timeToString(v.checkoutTime),
    };
    this.saving.set(true);
    this.api.saveHotel(data).subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.initialHotel = saved;
        this.hotelForm.reset(toForm(saved));
        this.notify.success('settings.toast.savedTitle', 'settings.toast.savedText');
      },
      error: (e: unknown) => {
        this.saving.set(false);
        if (e instanceof ApiError && e.code === 'settings.innInvalid') {
          this.notify.error('settings.toast.innTitle', 'settings.toast.innText');
        } else {
          this.notify.error('common.saveError', e instanceof ApiError ? `errors.${e.code}` : 'errors.common.unknown');
        }
      },
    });
  }

  // ----- Категории -----
  protected openAddCat(): void {
    this.catEditId.set(null);
    this.catTried.set(false);
    this.catForm.reset({ name: '', rooms: null, beds: '', price: null });
    this.catFormOpen.set(true);
  }

  protected openEditCat(): void {
    const c = this.selectedCat();
    if (!c) {
      return;
    }
    this.catEditId.set(c.id);
    this.catTried.set(false);
    this.catForm.reset({ name: c.name, rooms: c.rooms, beds: c.beds, price: c.price });
    this.catFormOpen.set(true);
  }

  protected catInvalid(name: 'name' | 'price'): boolean {
    return this.catTried() && this.catForm.controls[name].invalid;
  }

  protected saveCat(): void {
    this.catTried.set(true);
    if (this.catForm.invalid) {
      this.notify.error('common.requiredTitle', 'settings.toast.catRequired');
      return;
    }
    const v = this.catForm.getRawValue();
    const id = this.catEditId();
    this.saving.set(true);
    this.api
      .saveCategory(
        { name: v.name, rooms: v.rooms ?? 0, beds: v.beds.trim() || '—', price: v.price ?? 0 },
        id,
      )
      .subscribe({
        next: (saved) => {
          this.saving.set(false);
          this.catFormOpen.set(false);
          this.categories.update((l) =>
            id === null ? [...l, saved] : l.map((c) => (c.id === id ? saved : c)),
          );
          this.selectedCatId.set(saved.id);
          if (id === null) {
            this.notify.success('settings.toast.catAddedTitle', 'settings.toast.catAddedText', {
              name: saved.name,
              price: formatSum(saved.price),
            });
          } else {
            this.notify.success('common.savedTitle', 'settings.toast.catUpdatedText', {
              name: saved.name,
            });
          }
        },
        error: (e: unknown) => {
          this.saving.set(false);
          if (e instanceof ApiError && e.code === 'settings.categoryExists') {
            this.notify.error(
              'settings.toast.catExistsTitle',
              'settings.toast.catExistsText',
              { name: v.name.trim() },
            );
          } else {
            this.notify.error('common.saveError', e instanceof ApiError ? `errors.${e.code}` : 'errors.common.unknown');
          }
        },
      });
  }

  protected askDeleteCat(): void {
    if (this.selectedCat()) {
      this.confirmOpen.set(true);
    }
  }

  protected doDeleteCat(): void {
    const c = this.selectedCat();
    if (!c) {
      return;
    }
    this.saving.set(true);
    this.api.removeCategory(c.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.confirmOpen.set(false);
        this.categories.update((l) => l.filter((x) => x.id !== c.id));
        this.selectedCatId.set(null);
        this.notify.success('settings.toast.catDeletedTitle', 'settings.toast.catDeletedText', {
          name: c.name,
        });
      },
      error: (e: unknown) => {
        this.saving.set(false);
        this.confirmOpen.set(false);
        this.notify.error('common.saveError', e instanceof ApiError ? `errors.${e.code}` : 'errors.common.unknown');
      },
    });
  }

}

/** Ячейка «Действие»: цветной значок события + текст (DOM, без innerHTML). */
function logActionCell(tone: { glyph: string; bg: string; fg: string }, text: string): HTMLElement {
  const wrap = document.createElement('span');
  wrap.style.cssText = 'display:flex;align-items:center;gap:10px;min-width:0';
  const icon = document.createElement('span');
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = tone.glyph;
  icon.style.cssText = `width:28px;height:28px;flex:none;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;background:${tone.bg};color:${tone.fg}`;
  const label = document.createElement('span');
  label.textContent = text;
  label.style.cssText = 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
  wrap.append(icon, label);
  return wrap;
}

/** «14:00» → Date (для календаря PrimeNG в режиме выбора времени). */
function stringToTime(value: string): Date | null {
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h)) {
    return null;
  }
  const d = new Date(2000, 0, 1);
  d.setHours(h, m || 0, 0, 0);
  return d;
}

function timeToString(value: Date | null): string {
  return value
    ? `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
    : '';
}

function toForm(h: HotelSettings) {
  return {
    ...h,
    checkinTime: stringToTime(h.checkinTime),
    checkoutTime: stringToTime(h.checkoutTime),
  };
}
