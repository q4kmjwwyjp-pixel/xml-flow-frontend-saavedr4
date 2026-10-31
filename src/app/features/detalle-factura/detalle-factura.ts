import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FacturaService } from '../../core/services/factura.service';
import { AuthService } from '../../core/services/auth.service';
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
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './detalle-factura.html',
  styleUrl: './detalle-factura.css',
})
export class DetalleFactura implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private facturaService = inject(FacturaService);
  public authService = inject(AuthService);

  cargando = signal(true);
  error = signal('');
  factura = signal<FacturaResumen | null>(null);
  todasLasFacturas = signal<FacturaResumen[]>([]);
  procesandoCambioEstado = signal(false);
  eliminandoFactura = signal(false);

  // Estado del Folio de Contrarrecibo y Fecha Programada de Pago
  folioContrarreciboInput = signal<string>('');
  fechaProgramadaInput = signal<string>('');
  diasCreditoInput = signal<number | null>(null);
  guardandoContrarrecibo = signal<boolean>(false);
  guardandoFechaPago = signal<boolean>(false);
  notificacion = signal<{ tipo: 'exito' | 'error'; mensaje: string } | null>(
    null
  );

  origenNavegacion = signal<'reportes' | 'pagos' | 'dashboard'>('pagos');
  retornoPagos = signal<'reportes' | 'dashboard'>('dashboard');

  textoBotonRegresar = computed(() => {
    const origen = this.origenNavegacion();
    if (origen === 'reportes') return '← Regresar a Generador de Reportes';
    if (origen === 'dashboard') return '← Regresar al Dashboard';
    return '← Volver a Pagos Programados';
  });

  /** Facturas adicionales que comparten el mismo Folio de Contrarrecibo */
  otrasFacturasConMismoFolio = computed(() => {
    const actual = this.factura();
    const folioBuscado = (
      this.folioContrarreciboInput() ||
      actual?.folioContrarrecibo ||
      ''
    )
      .trim()
      .toUpperCase();
    if (!folioBuscado) return [];

    return this.todasLasFacturas().filter(
      (f) =>
        f.uuid !== actual?.uuid &&
        (f.folioContrarrecibo || '').trim().toUpperCase() === folioBuscado
    );
  });

  /** Estado de vencimiento calculado a partir de la fecha límite de pago. */
  vencimiento = computed(() => {
    const f = this.factura();
    return f ? calcularVencimiento(f) : null;
  });

  /** Etiqueta y clase CSS del estado. Adaptado al modelo: Pendiente, Pagado, Vencido */
  estadoVisual = computed(() => {
    const f = this.factura();
    if (!f) return { texto: '', clase: '' };

    const estadoDB = (f.estado || 'pendiente').toLowerCase();

    if (estadoDB === 'pagado') return { texto: '🟢 PAGADO', clase: 'pagada' };
    if (estadoDB === 'vencido')
      return { texto: '🔴 VENCIDA', clase: 'vencida' };

    if (this.vencimiento()?.vencida)
      return { texto: '🔴 VENCIDA (NO PAGADA)', clase: 'vencida' };

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
      {
        etiqueta: 'Régimen fiscal del receptor',
        valor: this.regimen(f.regimenReceptor),
        ok: !!c.regimenValido,
      },
      {
        etiqueta: 'Uso de CFDI',
        valor: this.uso(f.usoCfdi),
        ok: !!c.usoCfdiValido,
      },
      {
        etiqueta: 'Método de pago',
        valor: this.metodo(f.metodoPago),
        ok: !!c.metodoPagoValido,
      },
      {
        etiqueta: 'Forma de pago',
        valor: this.forma(f.formaPago),
        ok: !!c.formaPagoValida,
      },
      {
        etiqueta:
          'Días de crédito en XML (Nodo <cfdi:Comprobante> atributo CondicionesDePago)',
        valor: f.condicionesPago
          ? `Especificado en XML: "${f.condicionesPago}"`
          : `No hay días de crédito en XML (Falta el atributo CondicionesDePago en el nodo <cfdi:Comprobante>). Se mantiene fijo el plazo del proveedor (${f.diasCredito || 0} días).`,
        ok: Boolean(
          f.condicionesPago && /\b(\d+)\s*d[ií]as?\b/i.test(f.condicionesPago)
        ),
      },
    ];
  });

  ngOnInit() {
    this.route.queryParamMap.subscribe((qParams) => {
      const stateActual =
        (this.location.getState() as Record<string, any>) || {};
      const origen = qParams.get('origen') || stateActual['origen'] || 'pagos';
      const retorno =
        qParams.get('retorno') || stateActual['retorno'] || 'dashboard';

      if (origen === 'reportes') {
        this.origenNavegacion.set('reportes');
      } else if (origen === 'dashboard') {
        this.origenNavegacion.set('dashboard');
      } else {
        this.origenNavegacion.set('pagos');
      }

      this.retornoPagos.set(retorno === 'reportes' ? 'reportes' : 'dashboard');
    });

    this.cargarListaGlobal();

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

  private cargarListaGlobal(): void {
    this.facturaService.getFacturas().subscribe({
      next: (lista) => this.todasLasFacturas.set(lista || []),
      error: () => {},
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
        this.folioContrarreciboInput.set(f.folioContrarrecibo || '');
        this.fechaProgramadaInput.set(f.fechaProgramacionPago || '');
        this.diasCreditoInput.set(
          f.diasCredito && f.diasCredito > 0 ? f.diasCredito : null
        );
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error al cargar el detalle de la factura:', err);
        this.error.set(
          'No se pudo cargar la factura. Verifica tu conexión o que la factura exista.'
        );
        this.cargando.set(false);
      },
    });
  }

  guardarFolioContrarrecibo(): void {
    const f = this.factura();
    if (!f || !f.uuid) return;

    const uuid = f.uuid;
    const nuevoFolio = (this.folioContrarreciboInput() || '').trim();

    this.guardandoContrarrecibo.set(true);
    this.notificacion.set(null);

    this.facturaService
      .actualizarContrarrecibo(uuid, nuevoFolio || null)
      .subscribe({
        next: (facturaActualizada) => {
          this.factura.set(facturaActualizada);
          this.folioContrarreciboInput.set(
            facturaActualizada.folioContrarrecibo || ''
          );
          this.guardandoContrarrecibo.set(false);
          this.cargarListaGlobal();
          this.mostrarNotificacion(
            'exito',
            nuevoFolio
              ? `Folio de Contrarrecibo #${nuevoFolio} guardado correctamente.`
              : 'Folio de Contrarrecibo desvinculado correctamente.'
          );
        },
        error: (err) => {
          console.error('Error al guardar folio de contrarrecibo:', err);
          this.guardandoContrarrecibo.set(false);
          this.mostrarNotificacion(
            'error',
            'No se pudo guardar el Folio de Contrarrecibo. Intenta nuevamente.'
          );
        },
      });
  }

  onDiasCreditoDetalleChange(valor: number | string | null): void {
    const dias =
      valor !== null && valor !== '' && !Number.isNaN(Number(valor))
        ? Math.max(0, Math.round(Number(valor)))
        : null;
    this.diasCreditoInput.set(dias);

    if (dias !== null) {
      const f = this.factura();
      const baseStr = f?.fechaRevision || new Date().toISOString().split('T')[0];
      const base = new Date(`${baseStr}T12:00:00`);
      if (!Number.isNaN(base.getTime())) {
        base.setDate(base.getDate() + dias);
        const y = base.getFullYear();
        const m = String(base.getMonth() + 1).padStart(2, '0');
        const d = String(base.getDate()).padStart(2, '0');
        this.fechaProgramadaInput.set(`${y}-${m}-${d}`);
      }
    }
  }

  guardarFechaProgramadaPago(): void {
    const f = this.factura();
    if (!f || !f.uuid) return;

    const uuid = f.uuid;
    const nuevaFecha = (this.fechaProgramadaInput() || '').trim() || null;

    this.guardandoFechaPago.set(true);
    this.notificacion.set(null);

    this.facturaService
      .actualizarProgramacionPago(uuid, {
        fechaEstimadaPago: nuevaFecha,
      })
      .subscribe({
        next: (facturaActualizada) => {
          this.factura.set(facturaActualizada);
          this.fechaProgramadaInput.set(
            facturaActualizada.fechaProgramacionPago || ''
          );
          this.guardandoFechaPago.set(false);
          this.cargarListaGlobal();
          this.mostrarNotificacion(
            'exito',
            nuevaFecha
              ? `Fecha programada de pago actualizada al ${nuevaFecha}.`
              : 'Fecha programada de pago eliminada.'
          );
        },
        error: () => {
          this.guardandoFechaPago.set(false);
          this.mostrarNotificacion(
            'error',
            'No se pudo guardar la fecha programada de pago. Intenta nuevamente.'
          );
        },
      });
  }

  eliminarFacturaActual(): void {
    if (!this.authService.esAdmin()) return;
    const f = this.factura();
    if (!f || !f.uuid) return;

    if (
      !confirm(
        `¿Estás seguro de ELIMINAR permanentemente el XML de la factura ${f.folio} (${f.nombreProveedor})?`
      )
    ) {
      return;
    }

    this.eliminandoFactura.set(true);
    this.facturaService.eliminarFactura(f.uuid).subscribe({
      next: () => {
        this.eliminandoFactura.set(false);
        this.regresar();
      },
      error: () => {
        this.eliminandoFactura.set(false);
        this.mostrarNotificacion(
          'error',
          'No se pudo eliminar la factura XML. Intenta nuevamente.'
        );
      },
    });
  }

  private mostrarNotificacion(
    tipo: 'exito' | 'error',
    mensaje: string
  ): void {
    this.notificacion.set({ tipo, mensaje });
    setTimeout(() => {
      if (this.notificacion()?.mensaje === mensaje) {
        this.notificacion.set(null);
      }
    }, 4500);
  }

  marcarComoPagado() {
    const f = this.factura();
    if (!f || !f.uuid) return;

    const uuid = f.uuid;

    if (!confirm(`¿Estás seguro de marcar la factura ${f.folio} como PAGADA?`))
      return;

    this.procesandoCambioEstado.set(true);
    this.facturaService.marcarComoPagado(uuid).subscribe({
      next: () => {
        this.cargar(uuid);
        this.procesandoCambioEstado.set(false);
        this.mostrarNotificacion(
          'exito',
          `La factura ${f.folio} fue marcada como PAGADA.`
        );
      },
      error: (err) => {
        console.error('Error al actualizar a Pagado:', err);
        this.procesandoCambioEstado.set(false);
        this.mostrarNotificacion(
          'error',
          'Ocurrió un error al actualizar el estado de la factura.'
        );
      },
    });
  }

  marcarComoVencido() {
    const f = this.factura();
    if (!f || !f.uuid) return;

    const uuid = f.uuid;

    if (!confirm(`¿Estás seguro de marcar la factura ${f.folio} como VENCIDA?`))
      return;

    this.procesandoCambioEstado.set(true);
    this.facturaService.marcarComoVencido(uuid).subscribe({
      next: () => {
        this.cargar(uuid);
        this.procesandoCambioEstado.set(false);
        this.mostrarNotificacion(
          'exito',
          `La factura ${f.folio} fue marcada como VENCIDA.`
        );
      },
      error: (err) => {
        console.error('Error al actualizar a Vencido:', err);
        this.procesandoCambioEstado.set(false);
        this.mostrarNotificacion(
          'error',
          'Ocurrió un error al actualizar el estado de la factura.'
        );
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
