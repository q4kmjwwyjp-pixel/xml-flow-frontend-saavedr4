// logo-xml-flow.component.ts
import { Component } from '@angular/core';

@Component({
  selector: 'app-logo-xml-flow',
  standalone: true,
  template: `
    <div class="inline-flex flex-col items-center gap-1.5 select-none">
      <img
        src="logo-vexel.png?v=3"
        alt="Logo VEXEL"
        class="w-20 h-20 object-contain drop-shadow-sm"
      >
      <span class="text-xl font-extrabold tracking-wider bg-gradient-to-r from-blue-900 via-blue-600 to-emerald-600 bg-clip-text text-transparent">
        VEXEL
      </span>
    </div>
  `
})
export class LogoXmlFlowComponent {}
