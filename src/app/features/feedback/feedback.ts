import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { CommentsService } from '../../core/data/comments.service';
import { RoomQrService } from '../../core/data/room-qr.service';
import { SettingsService } from '../../core/data/settings.service';
import { LanguageService } from '../../core/i18n/language.service';
import { NotifyService } from '../../core/notify/notify.service';
import { Icon } from '../../shared/ui/icon/icon';
import { LangSwitch } from '../../shared/ui/lang-switch/lang-switch';

const MAX_TEXT = 500;

/**
 * Публичная страница, которая открывается по QR-коду из номера (`/c/:room`).
 * Без входа в систему: гость ставит оценку, пишет комментарий и (по желанию) имя.
 */
@Component({
  selector: 'app-feedback',
  imports: [FormsModule, TranslocoPipe, ButtonModule, InputText, Textarea, Icon, LangSwitch],
  templateUrl: './feedback.html',
  host: { class: 'flex min-h-dvh flex-col bg-app' },
})
export class FeedbackPage {
  /** Номер комнаты из адреса (withComponentInputBinding). */
  readonly room = input.required<string>();

  private readonly qr = inject(RoomQrService);
  private readonly comments = inject(CommentsService);
  private readonly settings = inject(SettingsService);
  private readonly notify = inject(NotifyService);
  private readonly transloco = inject(TranslocoService);
  private readonly title = inject(Title);
  private readonly lang = inject(LanguageService);

  protected readonly maxText = MAX_TEXT;

  /** Проверка, что QR-код этого номера включён. */
  protected readonly check = rxResource({
    params: () => this.room(),
    stream: ({ params }) => this.qr.check(params),
  });
  private readonly hotelRes = rxResource({ stream: () => this.settings.getHotel() });
  protected readonly hotel = computed(() =>
    this.hotelRes.hasValue() ? this.hotelRes.value() : null,
  );
  protected readonly hotelLetter = computed(() => this.hotel()?.name.charAt(0) ?? 'H');

  protected readonly rating = signal(0);
  protected readonly text = signal('');
  protected readonly name = signal('');
  protected readonly tried = signal(false);
  protected readonly sending = signal(false);
  protected readonly done = signal(false);

  protected readonly stars = [1, 2, 3, 4, 5];
  protected readonly noRate = computed(() => this.tried() && this.rating() === 0);
  protected readonly noText = computed(() => this.tried() && !this.text().trim());

  constructor() {
    effect(() => {
      this.lang.current();
      this.title.setTitle(`${this.transloco.translate('feedback.pageTitle')} · HotelOS`);
    });
  }

  protected setText(v: string): void {
    this.text.set(v.slice(0, MAX_TEXT));
  }

  protected submit(): void {
    this.tried.set(true);
    if (!this.rating() || !this.text().trim()) {
      return;
    }
    this.sending.set(true);
    this.comments
      .create({
        room: this.room(),
        rating: this.rating(),
        text: this.text().trim(),
        guest: this.name().trim(),
      })
      .subscribe({
        next: () => {
          this.sending.set(false);
          this.done.set(true);
        },
        error: () => {
          this.sending.set(false);
          this.notify.error('feedback.sendErrorTitle', 'feedback.sendErrorText');
        },
      });
  }

  protected again(): void {
    this.rating.set(0);
    this.text.set('');
    this.name.set('');
    this.tried.set(false);
    this.done.set(false);
  }
}
