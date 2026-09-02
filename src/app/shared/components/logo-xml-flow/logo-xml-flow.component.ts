import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

/**
 * Logo de XML Flow recreado en SVG (sin depender de un archivo de imagen
 * externo). Úsalo en cualquier interfaz con <app-logo-xml-flow></app-logo-xml-flow>.
 *
 * Si el equipo entrega un logo oficial en SVG/PNG más adelante, basta con
 * reemplazar el markup del <svg> por un <img [src]="..."> sin tocar el
 * resto de las pantallas que ya consumen este componente.
 */
@Component({
  selector: 'app-logo-xml-flow',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="xf-logo" [class.xf-logo--compact]="compact">
      <svg
        [attr.width]="size"
        [attr.height]="size"
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="48" height="48" rx="12" fill="#EAF1FF" />
        <path
          d="M10 30L19 21L25 27L38 14"
          stroke="#2F6FED"
          stroke-width="3.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path d="M30 14H38V22" stroke="#2F6FED" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
        <rect x="9" y="32" width="30" height="3" rx="1.5" fill="#16336B" />
      </svg>
      <span class="xf-logo__text" *ngIf="!iconOnly">
        <strong>XML</strong><span class="xf-logo__accent">Flow</span>
      </span>
    </div>
  `,
  styles: [
    `
      .xf-logo {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
      }
      .xf-logo__text {
        font-family: 'Segoe UI', system-ui, sans-serif;
        font-size: 1.35rem;
        color: #16336b;
        letter-spacing: -0.01em;
      }
      .xf-logo__text strong {
        font-weight: 800;
      }
      .xf-logo__accent {
        font-weight: 600;
        color: #2f6fed;
        margin-left: 2px;
      }
      .xf-logo--compact .xf-logo__text {
        font-size: 1.1rem;
      }
    `,
  ],
})
export class LogoXmlFlowComponent {
  @Input() size = 40;
  @Input() compact = false;
  @Input() iconOnly = false;
}
