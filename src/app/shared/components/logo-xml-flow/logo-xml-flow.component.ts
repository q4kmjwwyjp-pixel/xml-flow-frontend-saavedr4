// logo-xml-flow.component.ts
import { Component } from '@angular/core';

@Component({
  selector: 'app-logo-xml-flow',
  standalone: true,
  template: `
    <div class="inline-flex flex-col items-center gap-2 select-none">
      <img
        src="logo-vexel.png?v=3"
        alt="Logo VEXEL"
        class="w-16 h-16 object-contain"
      >
      <span class="text-lg font-bold tracking-widest text-slate-900 uppercase">
        VEXEL
      </span>
    </div>
  `
})
export class LogoXmlFlowComponent {}