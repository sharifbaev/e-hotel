import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NotifyService } from '../../../core/notify/notify.service';

/** Попап результата: круглая иконка (успех/ошибка) + заголовок + текст. Клик закрывает. */
@Component({
  selector: 'app-result-popup',
  imports: [TranslocoPipe],
  template: `
    @if (notify.message(); as m) {
      <div
        class="fade fixed inset-0 z-[1200] flex items-center justify-center bg-[rgba(16,24,40,.25)] p-4"
        (click)="notify.dismiss()"
      >
        <div
          class="pop flex w-full max-w-[340px] flex-col items-center gap-3 rounded-[18px] bg-white px-8 py-7 text-center shadow-[0_24px_48px_rgba(16,24,40,.18)]"
          role="status"
          aria-live="polite"
        >
          <div
            class="ring-in flex size-[68px] items-center justify-center rounded-full"
            [class]="m.ok ? 'bg-[#E7F6EC] text-[#067647]' : 'bg-[#FEE4E2] text-[#B42318]'"
          >
            <svg
              width="34"
              height="34"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              @if (m.ok) {
                <path class="draw" d="m5 12.5 4.5 4.5L19 7.5" />
              } @else {
                <path class="draw" d="M7 7l10 10M17 7 7 17" />
              }
            </svg>
          </div>
          <span class="text-lg font-semibold">{{ m.title | transloco: m.params }}</span>
          <span class="text-sm leading-normal text-muted">{{ m.text | transloco: m.params }}</span>
        </div>
      </div>
    }
  `,
})
export class ResultPopup {
  protected readonly notify = inject(NotifyService);
}
