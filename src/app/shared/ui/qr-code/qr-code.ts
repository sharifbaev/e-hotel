import { Component, effect, input, signal } from '@angular/core';
import { toDataURL } from 'qrcode';

/** Генерация PNG (data URL) с QR-кодом. Используется и для показа, и для скачивания/печати. */
export function qrDataUrl(value: string, width: number): Promise<string> {
  return toDataURL(value, {
    width,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#101828', light: '#ffffff' },
  });
}

/** QR-код как картинка. Значение (ссылка) кодируется на клиенте, без внешних сервисов. */
@Component({
  selector: 'app-qr-code',
  template: `
    @if (src(); as s) {
      <img
        class="fade block"
        [src]="s"
        [alt]="alt()"
        [width]="size()"
        [height]="size()"
        [style.width.px]="size()"
        [style.height.px]="size()"
      />
    } @else {
      <div class="sk rounded-xl" [style.width.px]="size()" [style.height.px]="size()"></div>
    }
  `,
  host: { class: 'block' },
})
export class QrCode {
  readonly value = input.required<string>();
  readonly size = input(200);
  readonly alt = input('');

  protected readonly src = signal<string | null>(null);

  constructor() {
    effect((onCleanup) => {
      const value = this.value();
      // Чёткая картинка на экранах с высокой плотностью пикселей.
      const width = this.size() * 3;
      let stale = false;
      onCleanup(() => (stale = true));
      this.src.set(null);
      qrDataUrl(value, width).then(
        (url) => !stale && this.src.set(url),
        () => !stale && this.src.set(null),
      );
    });
  }
}
