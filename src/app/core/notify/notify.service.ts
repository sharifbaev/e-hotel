import { Service, signal } from '@angular/core';

export interface ResultMessage {
  ok: boolean;
  /** Ключ i18n заголовка. */
  title: string;
  /** Ключ i18n текста. */
  text: string;
  params?: Record<string, unknown>;
}

/** Попап результата действия (иконка + текст), как в дизайне. Скрывается сам. */
@Service()
export class NotifyService {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly _message = signal<ResultMessage | null>(null);

  readonly message = this._message.asReadonly();

  success(title: string, text: string, params?: Record<string, unknown>): void {
    this.show({ ok: true, title, text, params });
  }

  error(title: string, text: string, params?: Record<string, unknown>): void {
    this.show({ ok: false, title, text, params });
  }

  dismiss(): void {
    clearTimeout(this.timer);
    this._message.set(null);
  }

  private show(message: ResultMessage): void {
    clearTimeout(this.timer);
    this._message.set(message);
    this.timer = setTimeout(() => this._message.set(null), message.ok ? 2400 : 3200);
  }
}
