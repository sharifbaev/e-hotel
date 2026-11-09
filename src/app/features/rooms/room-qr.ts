import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Select } from 'primeng/select';
import { RoomQrService } from '../../core/data/room-qr.service';
import { BreakpointService } from '../../core/layout/breakpoint.service';
import { NotifyService } from '../../core/notify/notify.service';
import { Icon } from '../../shared/ui/icon/icon';
import { QrCode, qrDataUrl } from '../../shared/ui/qr-code/qr-code';
import { Sheet } from '../../shared/ui/sheet/sheet';

type QrState = 'loading' | 'offline' | 'none' | 'noLan' | 'ready';

/**
 * QR-код номера для комментариев гостей: показ, копирование ссылки, печать, PNG.
 * Диалог на десктопе, нижняя шторка на телефоне.
 */
@Component({
  selector: 'app-room-qr',
  imports: [
    NgTemplateOutlet,
    FormsModule,
    TranslocoPipe,
    ButtonModule,
    Dialog,
    Select,
    Icon,
    QrCode,
    Sheet,
  ],
  template: `
    <ng-template #body>
      @switch (state()) {
        @case ('loading') {
          <div class="flex flex-col items-center gap-3.5 py-10">
            <div class="sk size-[200px] rounded-xl"></div>
          </div>
        }
        @case ('offline') {
          <div class="fade flex flex-col items-center gap-2.5 px-2 py-8 text-center">
            <div
              class="flex size-16 items-center justify-center rounded-full bg-danger-soft text-danger"
            >
              <app-icon name="qr" [size]="28" [stroke]="1.8" />
            </div>
            <span class="text-base font-semibold">{{ 'qr.offlineTitle' | transloco }}</span>
            <span class="max-w-[320px] text-[13px] leading-normal text-muted">{{
              'qr.offlineText' | transloco
            }}</span>
          </div>
        }
        @case ('none') {
          <div class="fade flex flex-col items-center gap-2.5 px-2 py-8 text-center">
            <div class="flex size-16 items-center justify-center rounded-full bg-chip text-muted">
              <app-icon name="qr" [size]="28" [stroke]="1.8" />
            </div>
            <span class="text-base font-semibold">{{ 'qr.noneTitle' | transloco }}</span>
            <span class="max-w-[300px] text-[13px] leading-normal text-muted">{{
              'qr.noneText' | transloco
            }}</span>
            <button
              pButton
              type="button"
              class="mt-2"
              [class.w-full]="bp.isMobile()"
              [loading]="busy()"
              (click)="create()"
            >
              @if (!busy()) {
                <app-icon name="plus" />
              }
              <span pButtonLabel>{{ 'qr.create' | transloco }}</span>
            </button>
          </div>
        }
        @case ('noLan') {
          <div class="fade flex flex-col items-center gap-2.5 px-2 py-8 text-center">
            <div class="flex size-16 items-center justify-center rounded-full bg-chip text-muted">
              <app-icon name="qr" [size]="28" [stroke]="1.8" />
            </div>
            <span class="text-base font-semibold">{{ 'qr.noLanTitle' | transloco }}</span>
            <span class="max-w-[320px] text-[13px] leading-normal text-muted">{{
              'qr.noLanText' | transloco
            }}</span>
          </div>
        }
        @case ('ready') {
          <div class="fade flex flex-col items-center gap-4">
            <figure
              class="m-0 flex w-[260px] flex-col items-center gap-3 rounded-2xl border border-line bg-white px-[18px] pt-[18px] pb-3.5 shadow-[0_6px_16px_rgba(16,24,40,.06)]"
            >
              <app-qr-code
                [value]="url()"
                [size]="200"
                [alt]="'qr.alt' | transloco: { room: room() }"
              />
              <figcaption class="flex flex-col items-center gap-0.5 text-center">
                <span class="text-[15px] font-bold">{{
                  'qr.caption' | transloco: { room: room() }
                }}</span>
                <span class="text-xs text-muted">{{ 'qr.scan' | transloco }}</span>
              </figcaption>
            </figure>

            @if (origins().length > 1) {
              <div class="flex w-full flex-col gap-1.5">
                <label for="qr-origin" class="field-label">{{ 'qr.address' | transloco }}</label>
                <p-select
                  inputId="qr-origin"
                  [options]="origins()"
                  [ngModel]="origin()"
                  (ngModelChange)="origin.set($event)"
                  [fluid]="true"
                  appendTo="body"
                />
              </div>
            }

            <div
              class="flex h-[42px] w-full items-center gap-2 rounded-lg border border-field bg-subtle pr-1.5 pl-3"
            >
              <span class="min-w-0 flex-1 truncate text-[13px] text-ink-2 tabular-nums">{{
                url()
              }}</span>
              <button
                pButton
                type="button"
                severity="secondary"
                [outlined]="true"
                size="small"
                (click)="copy()"
              >
                <app-icon name="copy" [size]="14" />
                <span pButtonLabel>{{ 'qr.copy' | transloco }}</span>
              </button>
            </div>
            <a [href]="url()" target="_blank" rel="noopener" class="text-[13px] font-medium">
              {{ 'qr.openGuest' | transloco }}
            </a>
          </div>
        }
      }
    </ng-template>

    <ng-template #actions>
      @if (state() === 'ready') {
        <div class="grid w-full grid-cols-2 gap-2.5">
          <button
            pButton
            type="button"
            severity="secondary"
            [outlined]="true"
            [class.h-12]="bp.isMobile()"
            (click)="print()"
          >
            <app-icon name="printer" />
            <span pButtonLabel>{{ 'qr.print' | transloco }}</span>
          </button>
          <button pButton type="button" [class.h-12]="bp.isMobile()" (click)="download()">
            <app-icon name="download" />
            <span pButtonLabel>{{ 'qr.download' | transloco }}</span>
          </button>
        </div>
      }
    </ng-template>

    @if (!bp.isMobile()) {
      <p-dialog
        [(visible)]="visible"
        [modal]="true"
        [draggable]="false"
        [resizable]="false"
        [style]="{ width: '440px', maxWidth: 'calc(100vw - 32px)' }"
        [styleClass]="state() === 'ready' ? 'hs-dialog' : 'hs-dialog hs-dialog-nofooter'"
        [closeAriaLabel]="'common.close' | transloco"
      >
        <ng-template #header>
          <div class="flex flex-col">
            <span class="text-lg font-semibold">{{
              'qr.title' | transloco: { room: room() }
            }}</span>
            <span class="text-[13px] text-muted">{{
              'qr.subtitle' | transloco: { category: category() }
            }}</span>
          </div>
        </ng-template>
        <ng-container [ngTemplateOutlet]="body" />
        <ng-template #footer>
          <ng-container [ngTemplateOutlet]="actions" />
        </ng-template>
      </p-dialog>
    } @else {
      <app-sheet
        [(visible)]="visible"
        [title]="'qr.title' | transloco: { room: room() }"
        [subtitle]="'qr.subtitle' | transloco: { category: category() }"
      >
        <div class="pb-1">
          <ng-container [ngTemplateOutlet]="body" />
        </div>
        <div sheetFooter>
          <ng-container [ngTemplateOutlet]="actions" />
        </div>
      </app-sheet>
    }
  `,
})
export class RoomQr {
  readonly visible = model(false);
  readonly room = input('');
  readonly category = input('');

  protected readonly qr = inject(RoomQrService);
  protected readonly bp = inject(BreakpointService);
  private readonly notify = inject(NotifyService);
  private readonly transloco = inject(TranslocoService);
  private readonly document = inject(DOCUMENT);

  protected readonly busy = signal(false);
  private readonly checked = signal(false);
  protected readonly origins = signal<string[]>([]);
  private readonly originsLoaded = signal(false);
  protected readonly origin = signal('');

  protected readonly url = computed(() => this.qr.feedbackUrl(this.origin(), this.room()));

  protected readonly state = computed<QrState>(() => {
    if (!this.checked()) {
      return 'loading';
    }
    if (this.qr.error()) {
      return 'offline';
    }
    if (!this.qr.isEnabled(this.room())) {
      return 'none';
    }
    if (!this.originsLoaded()) {
      return 'loading';
    }
    return this.origins().length ? 'ready' : 'noLan';
  });

  constructor() {
    // При каждом открытии перепроверяем сервер и сетевой адрес.
    effect(() => {
      if (!this.visible()) {
        return;
      }
      this.checked.set(false);
      this.originsLoaded.set(false);
      this.qr.load().subscribe(() => this.checked.set(true));
      this.qr.origins().subscribe((list) => {
        this.origins.set(list);
        this.origin.set(list[0] ?? '');
        this.originsLoaded.set(true);
      });
    });
  }

  protected create(): void {
    this.busy.set(true);
    this.qr.setEnabled(this.room(), true).subscribe({
      next: () => {
        this.busy.set(false);
        this.notify.success('qr.createdTitle', 'qr.createdText', { room: this.room() });
      },
      error: () => {
        this.busy.set(false);
        this.qr.error.set(true);
      },
    });
  }

  protected async copy(): Promise<void> {
    const text = this.url();
    try {
      // На http://<IP> Clipboard API недоступен (небезопасный контекст) — есть запасной путь.
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = this.document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;opacity:0;left:-9999px';
        this.document.body.append(ta);
        ta.select();
        const ok = this.document.execCommand('copy');
        ta.remove();
        if (!ok) {
          throw new Error('copy');
        }
      }
      this.notify.success('qr.copiedTitle', text);
    } catch {
      this.notify.error('qr.copyFailedTitle', 'qr.copyFailedText');
    }
  }

  protected async download(): Promise<void> {
    const file = this.transloco.translate('qr.fileName', { room: this.room() }) + '.png';
    const href = await qrDataUrl(this.url(), 1024);
    const a = this.document.createElement('a');
    a.href = href;
    a.download = file;
    this.document.body.append(a);
    a.click();
    a.remove();
    this.notify.success('qr.downloadedTitle', 'qr.downloadedText', { file });
  }

  /** Печать наклейки: QR + номер + подсказка, в скрытом iframe. */
  protected async print(): Promise<void> {
    const src = await qrDataUrl(this.url(), 900);
    const t = (k: string) => escapeHtml(this.transloco.translate(k, { room: this.room() }));
    const html = `<!doctype html><html lang="${escapeHtml(this.document.documentElement.lang)}"><head><meta charset="utf-8"><title>${t('qr.caption')}</title>
<style>@page{margin:16mm}body{margin:0;font-family:Inter,system-ui,sans-serif;color:#101828;display:flex;justify-content:center}
.card{width:80mm;border:1px solid #e4e7ec;border-radius:16px;padding:8mm 8mm 6mm;display:flex;flex-direction:column;align-items:center;gap:4mm;text-align:center}
img{width:64mm;height:64mm}h1{margin:0;font-size:20pt}p{margin:0;font-size:12pt;color:#475467}</style></head>
<body><div class="card"><img src="${src}" alt="${t('qr.alt')}"><h1>${t('qr.caption')}</h1><p>${t('qr.scan')}</p></div></body></html>`;
    const frame = this.document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
    frame.onload = () => {
      const w = frame.contentWindow;
      const img = frame.contentDocument?.querySelector('img');
      const go = () => {
        w?.focus();
        w?.print();
        setTimeout(() => frame.remove(), 1000);
      };
      if (img && !img.complete) {
        img.onload = go;
      } else {
        go();
      }
    };
    frame.srcdoc = html;
    this.document.body.append(frame);
  }
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
