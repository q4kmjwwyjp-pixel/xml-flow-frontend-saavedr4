import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FacturaService } from '../../core/services/factura.service';
import { FacturaResumen } from '../../core/models/factura.model';
import { calcularVencimiento } from '../../core/utils/factura-vencimiento';
import {
  FORMAS_PAGO,
  METODOS_PAGO,
  REGIMENES_FISCALES,
  USOS_CFDI,
  describirClave,
} from '../../core/utils/catalogos-sat';

interface CheckFiscal {
  etiqueta: string;
  valor: string;
  ok: boolean;
}

@Component({
  selector: 'app-detalle-factura',
  imports: [RouterLink],
  templateUrl: './detalle-factura.html',
  styleUrl: './detalle-factura.css',
})
export class DetalleFactura implements OnInit {
  private route = inject(ActivatedRoute);
  private facturaService = inject(FacturaService);

  cargando = signal(true);
  error = signal('');
  factura = signal<FacturaResumen | null>(null);

  /** Estado de vencimiento calculado a partir de la fecha límite de pago. */
  vencimiento = computed(() => {
    const f = this.factura();
    return f ? calcularVencimiento(f) : null;
  });

  /** Etiqueta y clase CSS del estado; "VENCIDA" tiene prioridad sobre "PAGO PROGRAMADO". */
  estadoVisual = computed(() => {
    const f = this.factura();
    if (!f) return { texto: '', clase: '' };
    if (this.vencimiento()?.vencida) return { texto: 'VENCIDA', clase: 'vencida' };
    if (f.estado === 'PROGRAMADA') return { texto: 'PAGO PROGRAMADO', clase: 'programada' };
    if (f.estado === 'PAGADA') return { texto: 'PAGADA (CONTADO)', clase: 'pagada' };
    return { texto: 'RECHAZADA', clase: 'rechazada' };
  });

  esCredito = computed(() => this.factura()?.metodoPago === 'PPD');

  /** Impuestos = total - subtotal (el backend no guarda el desglose de IVA por separado). */
  impuestos = computed(() => {
    const f = this.factura();
    return f && f.subTotal != null ? f.total - f.subTotal : null;
  });

  checks = computed<CheckFiscal[]>(() => {
    const f = this.factura();
    if (!f) return [];
    const c = f.checksFiscales;
    return [
      { etiqueta: 'Régimen fiscal del receptor', valor: this.regimen(f.regimenReceptor), ok: !!c.regimenValido },
      { etiqueta: 'Uso de CFDI', valor: this.uso(f.usoCfdi), ok: !!c.usoCfdiValido },
      { etiqueta: 'Método de pago', valor: this.metodo(f.metodoPago), ok: !!c.metodoPagoValido },
      { etiqueta: 'Forma de pago', valor: this.forma(f.formaPago), ok: !!c.formaPagoValida },
    ];
  });

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const uuid = params.get('uuid');
      if (!uuid) {
        this.error.set('No se indicó la factura a consultar.');
        this.cargando.set(false);
        return;
      }
      this.cargar(uuid);
    });
  }

  private cargar(uuid: string) {
    this.cargando.set(true);
    this.error.set('');
    this.facturaService.getFacturaPorUuid(uuid).subscribe({
      next: (f) => {
        this.factura.set(f);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error al cargar el detalle de la factura:', err);
        this.error.set('No se pudo cargar la factura. Verifica tu conexión o que la factura exista.');
        this.cargando.set(false);
      },
    });
  }

  moneda(valor: number | null | undefined): string {
    return (valor ?? 0).toLocaleString('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  metodo = (clave?: string) => describirClave(METODOS_PAGO, clave);
  forma = (clave?: string) => describirClave(FORMAS_PAGO, clave);
  uso = (clave?: string) => describirClave(USOS_CFDI, clave);
  regimen = (clave?: string) => describirClave(REGIMENES_FISCALES, clave);
}
