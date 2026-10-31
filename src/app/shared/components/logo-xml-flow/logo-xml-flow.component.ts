// logo-xml-flow.component.ts
import { Component } from '@angular/core';

@Component({
  selector: 'app-logo-xml-flow',
  standalone: true,
  template: `
    <div class="inline-flex flex-col items-center gap-1.5 select-none">
      <img
        src="logo-vexel.png"
        alt="Logo Vexel"
        class="w-20 h-20 object-contain rounded-2xl shadow-sm"
      >
      <span class="text-xl font-extrabold tracking-tight bg-gradient-to-r from-blue-900 via-blue-600 to-emerald-600 bg-clip-text text-transparent">
        VEXEL
      </span>
    </div>
  `
})
export class LogoXmlFlowComponent {}
