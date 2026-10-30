import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling, withViewTransitions } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withInMemoryScrolling({
        scrollPositionRestoration: 'top',
        anchorScrolling: 'enabled',
      }),
      withViewTransitions({
        skipInitialTransition: true,
        onViewTransitionCreated: ({ transition }) => {
          transition.finished.finally(() => {
            if (typeof document === 'undefined') return;
            const heading = document.querySelector('h1, h2') as HTMLElement | null;
            if (heading) {
              if (!heading.hasAttribute('tabindex')) {
                heading.setAttribute('tabindex', '-1');
              }
              heading.focus({ preventScroll: true });
            }
          });
        },
      })
    ),
    provideHttpClient(),
  ],
};
