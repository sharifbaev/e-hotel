/**
 * Общая логика полей с несъёмным началом (+998, grand_): курсор и выделение
 * не заходят в префикс, Backspace/Delete его не стирают.
 */
export function keepCaretAfterPrefix(input: HTMLInputElement, prefixLength: number): void {
  const start = input.selectionStart ?? 0;
  const end = input.selectionEnd ?? 0;
  if (start < prefixLength) {
    input.setSelectionRange(prefixLength, Math.max(end, prefixLength));
  }
}

/** true — нажатие стёрло бы часть префикса, его нужно отменить. */
export function wouldEditPrefix(
  e: KeyboardEvent,
  input: HTMLInputElement,
  prefixLength: number,
): boolean {
  const start = input.selectionStart ?? 0;
  const end = input.selectionEnd ?? 0;
  if (e.key === 'Backspace') {
    return start === end ? start <= prefixLength : start < prefixLength;
  }
  if (e.key === 'Delete') {
    return start < prefixLength;
  }
  return false;
}
