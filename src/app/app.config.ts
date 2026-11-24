import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  PreloadAllModules,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withPreloading,
} from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';
import {
  apiErrorInterceptor,
  authInterceptor,
  hotelInterceptor,
} from './core/api/api.interceptors';
import { AuthService } from './core/auth/auth.service';
import { LanguageService } from './core/i18n/language.service';
import { TranslocoHttpLoader } from './core/i18n/transloco-loader';
import { HotelOsPreset } from './core/theme/hotelos-preset';
import { PRIMEUI_LICENSE_KEY } from './core/theme/primeui-license';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
      // Код всех разделов подгружается в фоне после старта — клик по меню не ждёт загрузки
      withPreloading(PreloadAllModules),
    ),
    // Порядок: ответ сначала видит authInterceptor (обновление токена на 401),
    // затем hotelInterceptor (X-Hotel-Id, hotel.required / hotel.forbidden), затем ошибка → ApiError.
    provideHttpClient(
      withFetch(),
      withInterceptors([apiErrorInterceptor, hotelInterceptor, authInterceptor]),
    ),
    provideTransloco({
      config: {
        availableLangs: ['ru', 'uz-Latn', 'uz-Cyrl'],
        defaultLang: 'uz-Latn',
        fallbackLang: 'ru',
        reRenderOnLangChange: true,
        missingHandler: { useFallbackTranslation: true, logMissingKey: isDevMode() },
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
    providePrimeNG({
      license: PRIMEUI_LICENSE_KEY || undefined,
      ripple: false,
      theme: {
        preset: HotelOsPreset,
        options: {
          darkModeSelector: '.app-dark',
          cssLayer: { name: 'primeng', order: 'theme, base, primeng, components, utilities' },
        },
      },
    }),
    provideAppInitializer(() => inject(LanguageService).init()),
    provideAppInitializer(() => inject(AuthService).loadMe()),
  ],
};
