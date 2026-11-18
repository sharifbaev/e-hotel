import { Directive, ElementRef, effect, forwardRef, inject, input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { keepCaretAfterPrefix, wouldEditPrefix } from './prefix-caret';

/**
 * Логин одним полем (v1.7): в поле видно «grand_aziz», начало «grand_» стереть нельзя,
 * пользователь сразу пишет имя. `[appLoginPrefix]="'grand_'"` — префикс (может меняться,
 * например при вводе кода владельца). В модель формы — только имя (aziz):
 * полный логин собирает форма через joinLogin().
 */
@Directive({
  selector: 'input[appLoginPrefix]',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => LoginPrefixInputDirective),
      multi: true,
    },
  ],
  host: {
    autocomplete: 'off',
    autocapitalize: 'none',
    spellcheck: 'false',
    '(input)': 'onInput()',
    '(keydown)': 'onKeydown($event)',
    '(focus)': 'onCaret()',
    '(click)': 'onCaret()',
    '(keyup)': 'onCaret()',
    '(blur)': 'onTouched()',
  },
})
export class LoginPrefixInputDirective implements ControlValueAccessor {
  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef);
  readonly appLoginPrefix = input('');
  private name = '';
  private onChange: (v: string) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  constructor() {
    // Префикс изменился — перерисовать поле с тем же именем.
    effect(() => {
      this.appLoginPrefix();
      this.render();
    });
  }

  writeValue(value: string | null): void {
    this.name = value ?? '';
    this.render();
  }

  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.el.nativeElement.disabled = disabled;
  }

  protected onInput(): void {
    const input = this.el.nativeElement;
    const prefix = this.appLoginPrefix();
    if (input.value.startsWith(prefix)) {
      // Логины — строчные и без пробелов.
      this.name = input.value.slice(prefix.length).toLowerCase().replace(/\s+/g, '');
    }
    const caret = Math.max(input.selectionStart ?? input.value.length, prefix.length);
    this.render();
    const pos = Math.min(caret, input.value.length);
    input.setSelectionRange(pos, pos);
    this.onChange(this.name);
  }

  protected onKeydown(e: KeyboardEvent): void {
    const input = this.el.nativeElement;
    const len = this.appLoginPrefix().length;
    if (e.key === 'Home') {
      e.preventDefault();
      input.setSelectionRange(len, e.shiftKey ? (input.selectionEnd ?? 0) : len);
    } else if (wouldEditPrefix(e, input, len)) {
      e.preventDefault();
    }
  }

  protected onCaret(): void {
    keepCaretAfterPrefix(this.el.nativeElement, this.appLoginPrefix().length);
  }

  private render(): void {
    const value = this.appLoginPrefix() + this.name;
    if (this.el.nativeElement.value !== value) {
      this.el.nativeElement.value = value;
    }
  }
}
