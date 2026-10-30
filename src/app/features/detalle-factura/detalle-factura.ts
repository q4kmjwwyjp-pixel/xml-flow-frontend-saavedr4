import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
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
  imports: [],
  templateUrl: './detalle-factura.html',
  styleUrl: './detalle-factura.css',
})
export class DetalleFactura implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private facturaService = inject(FacturaService);

  cargando = signal(true);
  error = signal('');
  factura = signal<FacturaResumen | null>(null);
  procesandoCambioEstado = signal(false); // Para deshabilitar botones mientras carga

  origenNavegacion = signal<'reportes' | 'pagos' | 'dashboard'>('pagos');
  retornoPagos = signal<'reportes' | 'dashboard'>('dashboard');

  textoBotonRegresar = computed(() => {
    const origen = this.origenNavegacion();
    if (origen === 'reportes') return '← Regresar a Generador de Reportes';
    if (origen === 'dashboard') return '← Regresar al Dashboard';
    return '← Volver a Pagos Programados';
  });

  /** Estado de vencimiento calculado a partir de la fecha límite de pago. */
  vencimiento = computed(() => {
    const f = this.factura();
    return f ? calcularVencimiento(f) : null;
  });

  /** Etiqueta y clase CSS del estado. Adaptado al nuevo modelo: Pendiente, Pagado, Vencido */
  estadoVisual = computed(() => {
    const f = this.factura();
    if (!f) return { texto: '', clase: '' };
    
    // Leemos el estado directo de la base de datos (pasando a minúsculas para asegurar coincidencia)
    const estadoDB = (f.estado || 'pendiente').toLowerCase();

    if (estadoDB === 'pagado') return { texto: '🟢 PAGADO', clase: 'pagada' };
    if (estadoDB === 'vencido') return { texto: '🔴 VENCIDA', clase: 'vencida' };
    
    // Si está pendiente, evaluamos si ya se pasó la fecha
    if (this.vencimiento()?.vencida) return { texto: '🔴 VENCIDA (NO PAGADA)', clase: 'vencida' };
    
    return { texto: '🟡 PENDIENTE', clase: 'programada' };
  });

  esCredito = computed(() => this.factura()?.metodoPago === 'PPD');

  /** Impuestos = total - subtotal */
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
    this.route.queryParamMap.subscribe((qParams) => {
      const stateActual = (this.location.getState() as Record<string, any>) || {};
      const origen = qParams.get('origen') || stateActual['origen'] || 'pagos';
      const retorno = qParams.get('retorno') || stateActual['retorno'] || 'dashboard';

      if (origen === 'reportes') {
        this.origenNavegacion.set('reportes');
      } else if (origen === 'dashboard') {
        this.origenNavegacion.set('dashboard');
      } else {
        this.origenNavegacion.set('pagos');
      }

      this.retornoPagos.set(retorno === 'reportes' ? 'reportes' : 'dashboard');
    });

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

  regresar(): void {
    const origen = this.origenNavegacion();
    if (origen === 'reportes') {
      this.router.navigateByUrl('/reportes-semanales');
      return;
    }
    if (origen === 'dashboard') {
      this.router.navigateByUrl('/dashboard');
      return;
    }

    // Regresar a Pagos Programados conservando el origen previo (ej. si venía de Reportes Semanales)
    if (this.retornoPagos() === 'reportes') {
      this.router.navigate(['/pagos-programados'], {
        queryParams: { origen: 'reportes' },
        state: { origen: 'reportes' },
      });
      return;
    }
    this.router.navigate(['/pagos-programados']);
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

  // --- NUEVAS FUNCIONES PARA MARCAR ESTADOS MANUAMENTE ---

  marcarComoPagado() {
    const f = this.factura();
    if (!f || !f.uuid) return;
    
    const uuid = f.uuid; // <-- Guardamos en constante para que TypeScript sea feliz

    // Confirmación simple nativa de navegador
    if (!confirm(`¿Estás seguro de marcar la factura ${f.folio} como PAGADA?`)) return;

    this.procesandoCambioEstado.set(true);
    this.facturaService.marcarComoPagado(uuid).subscribe({ // <-- Usamos la constante
      next: () => {
        // Recargamos los datos para que el estado se actualice visualmente
        this.cargar(uuid); // <-- Usamos la constante
        this.procesandoCambioEstado.set(false);
      },
      error: (err) => {
        console.error('Error al actualizar a Pagado:', err);
        alert('Ocurrió un error al actualizar el estado de la factura.');
        this.procesandoCambioEstado.set(false);
      }
    });
  }

  marcarComoVencido() {
    const f = this.factura();
    if (!f || !f.uuid) return;

    const uuid = f.uuid; // <-- Guardamos en constante 

    if (!confirm(`¿Estás seguro de marcar la factura ${f.folio} como VENCIDA?`)) return;

    this.procesandoCambioEstado.set(true);
    this.facturaService.marcarComoVencido(uuid).subscribe({ // <-- Usamos la constante
      next: () => {
        this.cargar(uuid); // <-- Usamos la constante
        this.procesandoCambioEstado.set(false);
      },
      error: (err) => {
        console.error('Error al actualizar a Vencido:', err);
        alert('Ocurrió un error al actualizar el estado de la factura.');
        this.procesandoCambioEstado.set(false);
      }
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
