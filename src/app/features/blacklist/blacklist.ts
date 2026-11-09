import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ColDef } from 'ag-grid-community';
import { ButtonModule } from 'primeng/button';
import { BlacklistService } from '../../core/data/blacklist.service';
import { LanguageService } from '../../core/i18n/language.service';
import { BreakpointService } from '../../core/layout/breakpoint.service';
import { NotifyService } from '../../core/notify/notify.service';
import { BlacklistEntry } from '../../core/models';
import { formatDateTime, initials } from '../../shared/format/format';
import { DmyPipe } from '../../shared/format/format.pipes';
import { avatarCell } from '../../shared/grid/cells';
import { DataGrid } from '../../shared/grid/data-grid';
import { dateFilter, staffFilter } from '../../shared/grid/grid-filters';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog/confirm-dialog';
import { Icon } from '../../shared/ui/icon/icon';
import { BlacklistDialog } from './blacklist-dialog';

const fullName = (e: BlacklistEntry) => `${e.lastName} ${e.firstName}`.trim();

/** «Чёрный список» — гости, которым отказано в заселении. Сверка при регистрации по документу. */
@Component({
  selector: 'app-blacklist',
  imports: [FormsModule, TranslocoPipe, ButtonModule, Icon, DataGrid, ConfirmDialog, BlacklistDialog, DmyPipe],
  templateUrl: './blacklist.html',
})
export class BlacklistPage {
  private readonly api = inject(BlacklistService);
  private readonly notify = inject(NotifyService);
  private readonly transloco = inject(TranslocoService);
  private readonly lang = inject(LanguageService);
  protected readonly bp = inject(BreakpointService);

  private readonly res = rxResource({ stream: () => this.api.list() });
  protected readonly rows = linkedSignal<BlacklistEntry[]>(() =>
    this.res.hasValue() ? this.res.value() : [],
  );
  protected readonly loading = computed(() => this.res.isLoading());
  protected readonly selected = signal<BlacklistEntry | null>(null);
  protected readonly search = signal('');

  protected readonly columns = computed<ColDef<BlacklistEntry>[]>(() => {
    this.lang.current();
    const t = (k: string) => this.transloco.translate(k);
    return [
      {
        colId: 'name',
        headerName: t('guests.col.name'),
        flex: 1.8,
        minWidth: 260,
        valueGetter: (p) => (p.data ? `${fullName(p.data)} ${p.data.middleName}`.trim() : ''),
        cellRenderer: (p: { value: string }) => avatarCell(p.value, { bg: '#FEE4E2', fg: '#B42318' }),
      },
      { field: 'doc', headerName: t('guests.col.doc'), flex: 1, cellClass: 'tabular-nums text-ink-2' },
      {
        colId: 'country',
        headerName: t('guests.col.country'),
        flex: 1,
        valueGetter: (p) => (p.data ? t('countries.' + p.data.country) : ''),
        cellClass: 'text-ink-2',
      },
      {
        field: 'reason',
        headerName: t('blacklist.reason'),
        flex: 2.2,
        minWidth: 240,
        wrapText: true,
        autoHeight: true,
        cellClass: 'text-ink-2',
      },
      {
        field: 'addedAt',
        headerName: t('blacklist.col.added'),
        flex: 1.1,
        sort: 'desc',
        minWidth: 170,
        valueFormatter: (p) => formatDateTime(p.value),
        ...dateFilter<BlacklistEntry>(),
        cellClass: 'text-ink-2',
      },
      {
        field: 'addedBy',
        headerName: t('blacklist.col.by'),
        flex: 1.2,
        minWidth: 180,
        cellClass: 'text-ink-2',
        ...staffFilter<BlacklistEntry>(),
      },
    ];
  });

  protected readonly rowId = (p: { data: BlacklistEntry }) => String(p.data.id);

  protected readonly mobileRows = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.rows().filter(
      (e) => !q || fullName(e).toLowerCase().includes(q) || e.doc.toLowerCase().includes(q),
    );
  });

  protected initials(e: BlacklistEntry): string {
    return initials(fullName(e));
  }

  // ----- Добавить -----
  protected readonly addOpen = signal(false);

  protected onAdded(e: BlacklistEntry): void {
    this.rows.update((list) => [e, ...list]);
  }

  // ----- Убрать -----
  protected readonly confirmOpen = signal(false);
  protected readonly removing = signal(false);
  protected readonly target = signal<BlacklistEntry | null>(null);
  protected readonly targetName = computed(() => {
    const e = this.target();
    return e ? fullName(e) : '';
  });

  protected askRemove(e: BlacklistEntry | null = this.selected()): void {
    if (!e) {
      return;
    }
    this.target.set(e);
    this.confirmOpen.set(true);
  }

  protected remove(): void {
    const e = this.target();
    if (!e) {
      return;
    }
    this.removing.set(true);
    this.api.remove(e.id).subscribe({
      next: () => {
        this.removing.set(false);
        this.confirmOpen.set(false);
        this.rows.update((list) => list.filter((x) => x.id !== e.id));
        if (this.selected()?.id === e.id) {
          this.selected.set(null);
        }
        this.notify.success('blacklist.toast.removedTitle', 'blacklist.toast.removedText', {
          name: fullName(e),
        });
      },
      error: () => {
        this.removing.set(false);
        this.notify.error('common.saveError', 'errors.common.unknown');
      },
    });
  }
}
