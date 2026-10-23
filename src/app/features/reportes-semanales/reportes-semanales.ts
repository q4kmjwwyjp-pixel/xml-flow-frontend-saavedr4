import { Component, OnInit, inject, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FacturaService } from '../../core/services/factura.service';
import { FacturaResumen } from '../../core/models/factura.model';
import { calcularVencimiento, InfoVencimiento } from '../../core/utils/factura-vencimiento';
import {
  FORMAS_PAGO,
  METODOS_PAGO,
  REGIMENES_FISCALES,
  USOS_CFDI,
  describirClave,
} from '../../core/utils/catalogos-sat';

export type CriterioFecha = 'programacion' | 'emision' | 'recepcion';
export type PeriodoRapido = 'ESTA_SEMANA' | 'SEMANA_PASADA' | 'PROXIMA_SEMANA' | 'ESTE_MES' | 'TODO' | 'PERSONALIZADO';

export interface ResumenProveedor {
  codigoProveedor: string;
  rfc: string;
  nombre: string;
  regimenFiscal: string;
  cantidadFacturas: number;
  subTotal: number;
  impuestos: number;
  montoPagado: number;
  saldoPendiente: number;
  total: number;
}

export interface KpisReporte {
  totalCfdis: number;
  subTotalAcumulado: number;
  impuestosTrasladados: number;
  granTotalFacturado: number;
  montoPagado: number;
  cantidadPagadas: number;
  montoPendienteEnTiempo: number;
  cantidadPendientesEnTiempo: number;
  montoVencidoExigible: number;
  cantidadVencidas: number;
}

@Component({
  selector: 'app-reportes-semanales',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './reportes-semanales.html',
  styleUrl: './reportes-semanales.css',
})
export class ReportesSemanales implements OnInit {
  private readonly facturaService = inject(FacturaService);
  private readonly cdr = inject(ChangeDetectorRef);

  cargando = signal<boolean>(true);
  errorCarga = signal<string | null>(null);

  todasLasFacturas: FacturaResumen[] = [];
  facturasFiltradas: FacturaResumen[] = [];
  resumenProveedores: ResumenProveedor[] = [];

  // Filtros de periodo y criterios
  criterioFecha: CriterioFecha = 'programacion';
  periodoActivo: PeriodoRapido = 'ESTA_SEMANA';
  fechaInicio: string = '';
  fechaFin: string = '';
  filtroEstado: string = 'TODOS';
  filtroCondicion: string = 'TODAS';
  filtroProveedorRfc: string = 'TODOS';
  busquedaTexto: string = '';

  // Metadatos del documento
  fechaHoraEmisionReporte: Date = new Date();
  folioReporte: string = '';

  // KPIs calculados
  kpis: KpisReporte = {
    totalCfdis: 0,
    subTotalAcumulado: 0,
    impuestosTrasladados: 0,
    granTotalFacturado: 0,
    montoPagado: 0,
    cantidadPagadas: 0,
    montoPendienteEnTiempo: 0,
    cantidadPendientesEnTiempo: 0,
    montoVencidoExigible: 0,
    cantidadVencidas: 0,
  };

  ngOnInit(): void {
    this.generarFolioReporte();
    this.seleccionarPeriodoRapido('ESTA_SEMANA', false);
    this.cargarFacturas();
  }

  private generarFolioReporte(): void {
    const ahora = new Date();
    const y = ahora.getFullYear();
    const m = String(ahora.getMonth() + 1).padStart(2, '0');
    const d = String(ahora.getDate()).padStart(2, '0');
    const h = String(ahora.getHours()).padStart(2, '0');
    const min = String(ahora.getMinutes()).padStart(2, '0');
    this.folioReporte = `REP-CONT-${y}${m}${d}-${h}${min}`;
    this.fechaHoraEmisionReporte = ahora;
  }

  cargarFacturas(): void {
    this.cargando.set(true);
    this.errorCarga.set(null);

    this.facturaService.getReporteSemanal().subscribe({
      next: (reporte) => {
        this.todasLasFacturas = reporte?.facturas || [];
        this.aplicarFiltros();

        if (this.facturasFiltradas.length === 0 && this.todasLasFacturas.length > 0) {
          this.seleccionarPeriodoRapido('TODO', true);
        }

        this.cargando.set(false);
        this.cdr.detectChanges();
      },
      error: () => {
        // Fallback a getFacturas() en caso de que el despliegue de /xml/reporte/semanal aún esté en curso
        this.facturaService.getFacturas().subscribe({
          next: (facturas) => {
            this.todasLasFacturas = facturas || [];
            this.aplicarFiltros();

            if (this.facturasFiltradas.length === 0 && this.todasLasFacturas.length > 0) {
              this.seleccionarPeriodoRapido('TODO', true);
            }

            this.cargando.set(false);
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('Error al cargar facturas para el reporte:', err);
            this.errorCarga.set('No se pudieron obtener los comprobantes del servidor. Verifica tu conexión.');
            this.cargando.set(false);
            this.cdr.detectChanges();
          },
        });
      },
    });
  }

  /** Lista única de proveedores disponibles para el selector */
  get proveedoresDisponibles(): { rfc: string; nombre: string }[] {
    const mapa = new Map<string, string>();
    for (const f of this.todasLasFacturas) {
      if (f.rfcEmisor && !mapa.has(f.rfcEmisor)) {
        mapa.set(f.rfcEmisor, f.nombreProveedor || f.rfcEmisor);
      }
    }
    return Array.from(mapa.entries())
      .map(([rfc, nombre]) => ({ rfc, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  /** Configura las fechas de inicio y fin según el botón rápido seleccionado */
  seleccionarPeriodoRapido(periodo: PeriodoRapido, recalcular: boolean = true): void {
    this.periodoActivo = periodo;
    const hoy = new Date();
    const diaSemana = hoy.getDay(); // 0 = Dom, 1 = Lun, ..., 6 = Sáb
    const diffLunes = diaSemana === 0 ? -6 : 1 - diaSemana;

    const lunesEstaSemana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + diffLunes);

    if (periodo === 'ESTA_SEMANA') {
      const domingoEstaSemana = new Date(lunesEstaSemana);
      domingoEstaSemana.setDate(lunesEstaSemana.getDate() + 6);
      this.fechaInicio = this.formatearIsoLocal(lunesEstaSemana);
      this.fechaFin = this.formatearIsoLocal(domingoEstaSemana);
    } else if (periodo === 'SEMANA_PASADA') {
      const lunesPasado = new Date(lunesEstaSemana);
      lunesPasado.setDate(lunesEstaSemana.getDate() - 7);
      const domingoPasado = new Date(lunesPasado);
      domingoPasado.setDate(lunesPasado.getDate() + 6);
      this.fechaInicio = this.formatearIsoLocal(lunesPasado);
      this.fechaFin = this.formatearIsoLocal(domingoPasado);
    } else if (periodo === 'PROXIMA_SEMANA') {
      const lunesProximo = new Date(lunesEstaSemana);
      lunesProximo.setDate(lunesEstaSemana.getDate() + 7);
      const domingoProximo = new Date(lunesProximo);
      domingoProximo.setDate(lunesProximo.getDate() + 6);
      this.fechaInicio = this.formatearIsoLocal(lunesProximo);
      this.fechaFin = this.formatearIsoLocal(domingoProximo);
    } else if (periodo === 'ESTE_MES') {
      const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
      this.fechaInicio = this.formatearIsoLocal(primerDia);
      this.fechaFin = this.formatearIsoLocal(ultimoDia);
    } else if (periodo === 'TODO') {
      this.fechaInicio = '';
      this.fechaFin = '';
    }

    if (recalcular) {
      this.aplicarFiltros();
    }
  }

  onCambioFechaManual(): void {
    this.periodoActivo = 'PERSONALIZADO';
    this.aplicarFiltros();
  }

  limpiarFiltros(): void {
    this.criterioFecha = 'programacion';
    this.filtroEstado = 'TODOS';
    this.filtroCondicion = 'TODAS';
    this.filtroProveedorRfc = 'TODOS';
    this.busquedaTexto = '';
    this.seleccionarPeriodoRapido('TODO', true);
  }

  /** Obtiene la fecha base de una factura según el criterio seleccionado */
  obtenerFechaPorCriterio(f: FacturaResumen): string {
    if (this.criterioFecha === 'programacion') {
      // Para facturas de contado (PUE) que no tienen fecha estimada de pago, usamos su fecha de emisión
      return f.fechaProgramacionPago || f.fechaEmision || f.fechaRevision || '';
    }
    if (this.criterioFecha === 'emision') {
      return f.fechaEmision || f.fechaRevision || '';
    }
    return f.fechaRevision || f.fechaEmision || '';
  }

  /** Determina el estado efectivo considerando tanto el estado en BD como el vencimiento por fecha */
  obtenerEstadoEfectivo(f: FacturaResumen): 'pagado' | 'pendiente' | 'vencido' {
    const est = (f.estado || 'pendiente').toLowerCase();
    if (est === 'pagado') return 'pagado';
    if (est === 'vencido') return 'vencido';
    const infoVenc = calcularVencimiento(f);
    if (infoVenc.vencida) return 'vencido';
    return 'pendiente';
  }

  obtenerSubtotal(f: FacturaResumen): number {
    if (f.subTotal != null && !isNaN(Number(f.subTotal)) && Number(f.subTotal) > 0) {
      return Number(f.subTotal);
    }
    return Number(((f.total || 0) / 1.16).toFixed(2));
  }

  obtenerImpuestos(f: FacturaResumen): number {
    const sub = this.obtenerSubtotal(f);
    const tot = Number(f.total || 0);
    return Math.max(0, Number((tot - sub).toFixed(2)));
  }

  /** Texto descriptivo del plazo / vencimiento para la cédula detallada */
  obtenerEstatusPlazo(f: FacturaResumen): { texto: string; clase: string } {
    const estadoEf = this.obtenerEstadoEfectivo(f);
    if (estadoEf === 'pagado') {
      return { texto: 'Saldada / Liquidada', clase: 'plazo-saldada' };
    }
    if (f.metodoPago === 'PUE' && estadoEf !== 'vencido') {
      return { texto: 'Pago de Contado (PUE)', clase: 'plazo-tiempo' };
    }

    const v: InfoVencimiento = calcularVencimiento(f);
    if (estadoEf === 'vencido' || v.vencida) {
      const dias = v.diasVencida;
      return {
        texto: dias > 0 ? `Vencida hace ${dias} día${dias === 1 ? '' : 's'}` : 'Plazo vencido',
        clase: 'plazo-vencida',
      };
    }

    if (!f.fechaProgramacionPago) {
      return { texto: 'Por programar', clase: 'plazo-tiempo' };
    }

    if (v.diasRestantes === 0) {
      return { texto: '¡Vence hoy!', clase: 'plazo-hoy' };
    }

    return {
      texto: `Vence en ${v.diasRestantes} día${v.diasRestantes === 1 ? '' : 's'}`,
      clase: v.diasRestantes <= 3 ? 'plazo-proximo' : 'plazo-tiempo',
    };
  }

  aplicarFiltros(): void {
    this.generarFolioReporte();
    const texto = (this.busquedaTexto || '').trim().toLowerCase();

    this.facturasFiltradas = this.todasLasFacturas.filter((f) => {
      // 1. Filtro por rango de fechas según el criterio
      const fechaFactura = this.obtenerFechaPorCriterio(f);
      if (this.fechaInicio && (!fechaFactura || fechaFactura < this.fechaInicio)) {
        return false;
      }
      if (this.fechaFin && (!fechaFactura || fechaFactura > this.fechaFin)) {
        return false;
      }

      // 2. Filtro por estado
      if (this.filtroEstado !== 'TODOS') {
        const estadoEfectivo = this.obtenerEstadoEfectivo(f);
        const estadoBD = (f.estado || 'pendiente').toLowerCase();
        if (this.filtroEstado === 'vencido') {
          if (estadoEfectivo !== 'vencido' && estadoBD !== 'vencido') return false;
        } else if (this.filtroEstado === 'pendiente') {
          if (estadoEfectivo !== 'pendiente') return false;
        } else if (this.filtroEstado === 'pagado') {
          if (estadoEfectivo !== 'pagado') return false;
        }
      }

      // 3. Filtro por condición / método de pago
      if (this.filtroCondicion !== 'TODAS' && f.metodoPago !== this.filtroCondicion) {
        return false;
      }

      // 4. Filtro por proveedor
      if (this.filtroProveedorRfc !== 'TODOS' && f.rfcEmisor !== this.filtroProveedorRfc) {
        return false;
      }

      // 5. Filtro por búsqueda de texto (Folio, UUID, Proveedor, RFC)
      if (texto) {
        const coincide =
          (f.folio || '').toLowerCase().includes(texto) ||
          (f.uuid || '').toLowerCase().includes(texto) ||
          (f.nombreProveedor || '').toLowerCase().includes(texto) ||
          (f.rfcEmisor || '').toLowerCase().includes(texto) ||
          (f.codigoProveedor || '').toLowerCase().includes(texto);
        if (!coincide) return false;
      }

      return true;
    });

    // Ordenar por la fecha del criterio seleccionado (ascendente para programación, o más reciente)
    this.facturasFiltradas.sort((a, b) => {
      const fa = this.obtenerFechaPorCriterio(a) || '9999-12-31';
      const fb = this.obtenerFechaPorCriterio(b) || '9999-12-31';
      return fa.localeCompare(fb);
    });

    this.recalcularMetricasYAgrupaciones();
  }

  private recalcularMetricasYAgrupaciones(): void {
    let subTotalAcumulado = 0;
    let impuestosTrasladados = 0;
    let granTotalFacturado = 0;
    let montoPagado = 0;
    let cantidadPagadas = 0;
    let montoPendienteEnTiempo = 0;
    let cantidadPendientesEnTiempo = 0;
    let montoVencidoExigible = 0;
    let cantidadVencidas = 0;

    const mapaProveedores = new Map<string, ResumenProveedor>();

    for (const f of this.facturasFiltradas) {
      const sub = this.obtenerSubtotal(f);
      const imp = this.obtenerImpuestos(f);
      const tot = Number(f.total || 0);
      const estadoEf = this.obtenerEstadoEfectivo(f);

      subTotalAcumulado += sub;
      impuestosTrasladados += imp;
      granTotalFacturado += tot;

      if (estadoEf === 'pagado') {
        montoPagado += tot;
        cantidadPagadas++;
      } else if (estadoEf === 'vencido') {
        montoVencidoExigible += tot;
        cantidadVencidas++;
      } else {
        montoPendienteEnTiempo += tot;
        cantidadPendientesEnTiempo++;
      }

      // Agrupación por proveedor
      const rfcKey = f.rfcEmisor || 'SIN-RFC';
      let itemProv = mapaProveedores.get(rfcKey);
      if (!itemProv) {
        itemProv = {
          codigoProveedor: f.codigoProveedor || 'PRV-000',
          rfc: rfcKey,
          nombre: f.nombreProveedor || 'Proveedor Desconocido',
          regimenFiscal: f.regimenEmisor || '601',
          cantidadFacturas: 0,
          subTotal: 0,
          impuestos: 0,
          montoPagado: 0,
          saldoPendiente: 0,
          total: 0,
        };
        mapaProveedores.set(rfcKey, itemProv);
      }

      itemProv.cantidadFacturas += 1;
      itemProv.subTotal += sub;
      itemProv.impuestos += imp;
      itemProv.total += tot;
      if (estadoEf === 'pagado') {
        itemProv.montoPagado += tot;
      } else {
        itemProv.saldoPendiente += tot;
      }
    }

    this.kpis = {
      totalCfdis: this.facturasFiltradas.length,
      subTotalAcumulado,
      impuestosTrasladados,
      granTotalFacturado,
      montoPagado,
      cantidadPagadas,
      montoPendienteEnTiempo,
      cantidadPendientesEnTiempo,
      montoVencidoExigible,
      cantidadVencidas,
    };

    // Ordenar proveedores por mayor Saldo Pendiente por Pagar (y luego por Total)
    this.resumenProveedores = Array.from(mapaProveedores.values()).sort(
      (a, b) => b.saldoPendiente - a.saldoPendiente || b.total - a.total
    );
  }

  /** Etiqueta legible del criterio de fecha */
  get etiquetaCriterioFecha(): string {
    if (this.criterioFecha === 'programacion') return 'Fecha Programada de Pago (Tesorería)';
    if (this.criterioFecha === 'emision') return 'Fecha de Emisión del CFDI (Contabilidad)';
    return 'Fecha de Recepción / Escaneo XML';
  }

  /** Etiqueta legible del rango de fechas seleccionado */
  get etiquetaRangoPeriodo(): string {
    if (this.fechaInicio && this.fechaFin) {
      return `Del ${this.fechaInicio} al ${this.fechaFin}`;
    }
    if (this.fechaInicio) {
      return `Desde el ${this.fechaInicio}`;
    }
    if (this.fechaFin) {
      return `Hasta el ${this.fechaFin}`;
    }
    return 'Histórico Completo (Todos los periodos)';
  }

  /** Helpers de Catálogos SAT */
  describirMetodoPago(clave?: string): string {
    return describirClave(METODOS_PAGO, clave);
  }

  describirFormaPago(clave?: string): string {
    return describirClave(FORMAS_PAGO, clave);
  }

  describirUsoCfdi(clave?: string): string {
    return describirClave(USOS_CFDI, clave);
  }

  describirRegimen(clave?: string): string {
    return describirClave(REGIMENES_FISCALES, clave);
  }

  private formatearIsoLocal(fecha: Date): string {
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * Exporta la cédula completa a un archivo Excel (.xls) enriquecido (SpreadsheetML / HTML para Excel)
   * con anchos de columna predefinidos (<colgroup>), diseño corporativo (#0f2247 / #1e3a8a / #e2e8f0),
   * bordes de celda, formato de moneda nativo ($#,##0.00) y colores semánticos por estado.
   */
  exportarCsvContabilidad(): void {
    const esc = (valor: any): string => {
      if (valor === null || valor === undefined) return '';
      return String(valor)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    };

    const numVal = (n: number): string => (Number(n) || 0).toFixed(2);

    // Estilos inline reutilizables para compatibilidad 100% con Microsoft Excel (white-space: nowrap evita cortes verticales)
    const borderCell = 'border: 1px solid #cbd5e1; white-space: nowrap;';
    const styleMembreteTitulo =
      'background-color: #0f2247; color: #ffffff; font-family: Calibri, Arial, sans-serif; font-size: 15pt; font-weight: bold; text-align: left; vertical-align: middle; padding: 10px; white-space: nowrap;';
    const styleMembreteSub =
      'background-color: #0f2247; color: #e2e8f0; font-family: Calibri, Arial, sans-serif; font-size: 11pt; font-weight: bold; text-align: left; vertical-align: middle; padding: 6px 10px; white-space: nowrap;';
    const styleMetaLabel =
      `background-color: #e2e8f0; color: #0f2247; font-family: Calibri, Arial, sans-serif; font-size: 10pt; font-weight: bold; ${borderCell} padding: 6px;`;
    const styleMetaVal =
      `background-color: #f8fafc; color: #0f172a; font-family: Calibri, Arial, sans-serif; font-size: 10pt; ${borderCell} padding: 6px;`;

    const styleSectionBanner =
      'background-color: #1e3a8a; color: #ffffff; font-family: Calibri, Arial, sans-serif; font-size: 11pt; font-weight: bold; text-align: left; vertical-align: middle; padding: 8px 10px; border: 1px solid #0f2247; white-space: nowrap;';
    const styleTh =
      'background-color: #e2e8f0; color: #0f2247; font-family: Calibri, Arial, sans-serif; font-size: 10pt; font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #94a3b8; padding: 8px; white-space: nowrap;';
    const styleTdText =
      `background-color: #ffffff; color: #0f172a; font-family: Calibri, Arial, sans-serif; font-size: 10pt; text-align: left; vertical-align: middle; ${borderCell} padding: 6px; mso-number-format:'\\@';`;
    const styleTdCenter =
      `background-color: #ffffff; color: #0f172a; font-family: Calibri, Arial, sans-serif; font-size: 10pt; text-align: center; vertical-align: middle; ${borderCell} padding: 6px;`;
    const styleTdMoney =
      `background-color: #ffffff; color: #0f172a; font-family: Calibri, Arial, sans-serif; font-size: 10pt; text-align: right; vertical-align: middle; ${borderCell} padding: 6px; mso-number-format:'\\$\\#\\,\\#\\#0\\.00';`;
    const styleTdMoneyHighlight =
      `background-color: #eff6ff; color: #1e3a8a; font-family: Calibri, Arial, sans-serif; font-size: 10pt; font-weight: bold; text-align: right; vertical-align: middle; ${borderCell} padding: 6px; mso-number-format:'\\$\\#\\,\\#\\#0\\.00';`;
    const styleTotalLabel =
      'background-color: #e2e8f0; color: #0f2247; font-family: Calibri, Arial, sans-serif; font-size: 10.5pt; font-weight: bold; text-align: right; vertical-align: middle; border-top: 2px solid #0f2247; border-bottom: 2px solid #0f2247; border-left: 1px solid #94a3b8; border-right: 1px solid #94a3b8; padding: 8px; white-space: nowrap;';
    const styleTotalMoney =
      "background-color: #e2e8f0; color: #0f2247; font-family: Calibri, Arial, sans-serif; font-size: 10.5pt; font-weight: bold; text-align: right; vertical-align: middle; border-top: 2px solid #0f2247; border-bottom: 2px solid #0f2247; border-left: 1px solid #94a3b8; border-right: 1px solid #94a3b8; padding: 8px; white-space: nowrap; mso-number-format:'\\$\\#\\,\\#\\#0\\.00';";
    const styleGrandTotalMoney =
      "background-color: #dbeafe; color: #1e3a8a; font-family: Calibri, Arial, sans-serif; font-size: 11pt; font-weight: bold; text-align: right; vertical-align: middle; border-top: 2px solid #0f2247; border-bottom: 2px solid #0f2247; border-left: 1px solid #94a3b8; border-right: 1px solid #94a3b8; padding: 8px; white-space: nowrap; mso-number-format:'\\$\\#\\,\\#\\#0\\.00';";

    // Estilos semánticos de estado (PAGADO = verde, PENDIENTE = amarillo, VENCIDO = rojo claro)
    const obtenerEstiloEstado = (estado: 'pagado' | 'pendiente' | 'vencido', esMoneda: boolean = false): string => {
      const formatoMoneda = esMoneda ? "mso-number-format:'\\$\\#\\,\\#\\#0\\.00'; text-align: right;" : 'text-align: center;';
      if (estado === 'pagado') {
        return `background-color: #dcfce7; color: #15803d; font-family: Calibri, Arial, sans-serif; font-size: 10pt; font-weight: bold; vertical-align: middle; ${borderCell} padding: 6px; ${formatoMoneda}`;
      }
      if (estado === 'vencido') {
        return `background-color: #fee2e2; color: #b91c1c; font-family: Calibri, Arial, sans-serif; font-size: 10pt; font-weight: bold; vertical-align: middle; ${borderCell} padding: 6px; ${formatoMoneda}`;
      }
      return `background-color: #fef3c7; color: #b45309; font-family: Calibri, Arial, sans-serif; font-size: 10pt; font-weight: bold; vertical-align: middle; ${borderCell} padding: 6px; ${formatoMoneda}`;
    };

    // Anchos amplios en píxeles para las 20 columnas de modo que ningún texto o encabezado se corte
    const anchosColumnasPx = [
      160, // Col 1: Folio / Código Proveedor / Total CFDIs
      320, // Col 2: UUID Fiscal (36 chars) / RFC Emisor / Subtotal Acumulado
      310, // Col 3: Razón Social Proveedor / Impuestos Trasladados
      290, // Col 4: RFC Emisor / Régimen Fiscal / Gran Total Facturado
      330, // Col 5: Razón Social Emisor / Cant. Facturas / Monto Pagado
      290, // Col 6: Régimen Emisor / Subtotal Prov / Monto Pendiente
      245, // Col 7: Régimen Receptor / Impuestos Prov / Monto Vencido
      250, // Col 8: Uso CFDI / Monto Pagado Prov
      260, // Col 9: Método Pago / Saldo Pendiente a Dispersar
      270, // Col 10: Forma Pago / Total Facturado Prov
      150, // Col 11: Condición Crédito
      125, // Col 12: Días Crédito
      155, // Col 13: Fecha Emisión CFDI
      155, // Col 14: Fecha Recepción XML
      185, // Col 15: Fecha Límite / Programada Pago
      205, // Col 16: Estatus de Plazo
      165, // Col 17: Subtotal (MXN)
      175, // Col 18: Impuestos Trasladados (MXN)
      175, // Col 19: Total (MXN)
      165, // Col 20: Estado Contable
    ];

    const colgroupHtml =
      '<colgroup>' +
      anchosColumnasPx.map((w) => `<col width="${w}" style="width: ${w}px; mso-width-source: userset;" />`).join('') +
      '</colgroup>';

    // Filas del Concentrado por Proveedor (Sección II)
    const filasProveedoresHtml = this.resumenProveedores
      .map(
        (p) => `
        <tr height="36" style="height: 27pt; mso-height-source: userset;">
          <td style="${styleTdCenter} font-weight: bold; mso-number-format:'\\@';">${esc(p.codigoProveedor)}</td>
          <td style="${styleTdCenter} mso-number-format:'\\@';">${esc(p.rfc)}</td>
          <td style="${styleTdText} font-weight: bold;">${esc(p.nombre)}</td>
          <td style="${styleTdText}">${esc(this.describirRegimen(p.regimenFiscal))}</td>
          <td style="${styleTdCenter} font-weight: bold;">${p.cantidadFacturas}</td>
          <td style="${styleTdMoney}">${numVal(p.subTotal)}</td>
          <td style="${styleTdMoney}">${numVal(p.impuestos)}</td>
          <td style="${obtenerEstiloEstado('pagado', true)}">${numVal(p.montoPagado)}</td>
          <td style="${p.saldoPendiente > 0 ? obtenerEstiloEstado('pendiente', true) : styleTdMoneyHighlight}">${numVal(p.saldoPendiente)}</td>
          <td style="${styleTdMoney} font-weight: bold;">${numVal(p.total)}</td>
        </tr>`
      )
      .join('');

    // Filas de la Cédula Detallada (Sección III)
    const filasFacturasHtml = this.facturasFiltradas
      .map((f) => {
        const sub = this.obtenerSubtotal(f);
        const imp = this.obtenerImpuestos(f);
        const tot = Number(f.total || 0);
        const estadoEf = this.obtenerEstadoEfectivo(f);
        const plazo = this.obtenerEstatusPlazo(f).texto;

        return `
        <tr height="36" style="height: 27pt; mso-height-source: userset;">
          <td style="${styleTdCenter} font-weight: bold; mso-number-format:'\\@';">${esc(f.folio)}</td>
          <td style="${styleTdText} font-family: Consolas, monospace; font-size: 9.5pt;">${esc(f.uuid || 'N/A')}</td>
          <td style="${styleTdCenter} mso-number-format:'\\@';">${esc(f.codigoProveedor)}</td>
          <td style="${styleTdCenter} mso-number-format:'\\@';">${esc(f.rfcEmisor)}</td>
          <td style="${styleTdText} font-weight: bold;">${esc(f.nombreProveedor)}</td>
          <td style="${styleTdText}">${esc(this.describirRegimen(f.regimenEmisor))}</td>
          <td style="${styleTdText}">${esc(this.describirRegimen(f.regimenReceptor))}</td>
          <td style="${styleTdText}">${esc(this.describirUsoCfdi(f.usoCfdi))}</td>
          <td style="${styleTdText}">${esc(this.describirMetodoPago(f.metodoPago))}</td>
          <td style="${styleTdText}">${esc(this.describirFormaPago(f.formaPago))}</td>
          <td style="${styleTdCenter}">${esc(f.metodoPago === 'PPD' ? 'Crédito (PPD)' : 'Contado (PUE)')}</td>
          <td style="${styleTdCenter}">${f.diasCredito || 0}</td>
          <td style="${styleTdCenter} mso-number-format:'\\@';">${esc(f.fechaEmision || '')}</td>
          <td style="${styleTdCenter} mso-number-format:'\\@';">${esc(f.fechaRevision || '')}</td>
          <td style="${styleTdCenter} font-weight: bold; mso-number-format:'\\@';">${esc(f.fechaProgramacionPago || f.fechaEmision || '')}</td>
          <td style="${obtenerEstiloEstado(estadoEf, false)}">${esc(plazo)}</td>
          <td style="${styleTdMoney}">${numVal(sub)}</td>
          <td style="${styleTdMoney}">${numVal(imp)}</td>
          <td style="${styleTdMoney} font-weight: bold;">${numVal(tot)}</td>
          <td style="${obtenerEstiloEstado(estadoEf, false)}">${esc(estadoEf.toUpperCase())}</td>
        </tr>`;
      })
      .join('');

    const htmlExcel = `\uFEFF<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8" />
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>Cedula Contable CFDI 4.0</x:Name>
          <x:WorksheetOptions>
            <x:DisplayGridlines/>
          </x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
</head>
<body>
  <table border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse; white-space: nowrap;">
    ${colgroupHtml}

    <!-- MEMBRETE CORPORATIVO -->
    <tr height="42" style="height: 31.5pt; mso-height-source: userset;">
      <td colspan="10" style="${styleMembreteTitulo}">
        TRANSPORTES DE LOS SANTOS E HIJOS — CÉDULA CONTABLE Y DE TESORERÍA (CFDI 4.0)
      </td>
    </tr>
    <tr height="36" style="height: 27pt; mso-height-source: userset;">
      <td colspan="10" style="${styleMembreteSub}">
        RFC Receptor: TSH7311116TL4 &nbsp;|&nbsp; Régimen Fiscal: 624 - Coordinados &nbsp;|&nbsp; Uso CFDI Autorizado: G03 - Gastos en general
      </td>
    </tr>
    <tr height="36" style="height: 27pt; mso-height-source: userset;">
      <td style="${styleMetaLabel}">Folio de Reporte:</td>
      <td style="${styleMetaVal} font-weight: bold;">${esc(this.folioReporte)}</td>
      <td style="${styleMetaLabel}">Fecha y Hora de Emisión:</td>
      <td style="${styleMetaVal}">${esc(this.fechaHoraEmisionReporte.toLocaleString('es-MX'))}</td>
      <td style="${styleMetaLabel}">Criterio de Periodo:</td>
      <td colspan="2" style="${styleMetaVal} font-weight: bold;">${esc(this.etiquetaCriterioFecha)}</td>
      <td style="${styleMetaLabel}">Rango Consultado:</td>
      <td colspan="2" style="${styleMetaVal} font-weight: bold; color: #1e3a8a;">${esc(this.etiquetaRangoPeriodo)}</td>
    </tr>
    <tr height="18"><td colspan="10"></td></tr>

    <!-- SECCIÓN I: RESUMEN FINANCIERO Y FLUJO DE EFECTIVO -->
    <tr height="36" style="height: 27pt; mso-height-source: userset;">
      <td colspan="7" style="${styleSectionBanner}">
        I. RESUMEN FINANCIERO, FISCAL Y DE FLUJO DE EFECTIVO DEL PERIODO
      </td>
    </tr>
    <tr height="36" style="height: 27pt; mso-height-source: userset;">
      <th style="${styleTh}">Total CFDIs</th>
      <th style="${styleTh}">Subtotal Acumulado (MXN)</th>
      <th style="${styleTh}">Impuestos Trasladados Est. (MXN)</th>
      <th style="${styleTh}">Gran Total Facturado (MXN)</th>
      <th style="${styleTh}">Monto Pagado / Liquidado (MXN)</th>
      <th style="${styleTh}">Monto Pendiente en Tiempo (MXN)</th>
      <th style="${styleTh}">Monto Vencido / Exigible (MXN)</th>
    </tr>
    <tr height="36" style="height: 27pt; mso-height-source: userset;">
      <td style="${styleTdCenter} font-size: 11pt; font-weight: bold;">${this.kpis.totalCfdis}</td>
      <td style="${styleTdMoney} font-size: 11pt; font-weight: bold;">${numVal(this.kpis.subTotalAcumulado)}</td>
      <td style="${styleTdMoney} font-size: 11pt; font-weight: bold;">${numVal(this.kpis.impuestosTrasladados)}</td>
      <td style="${styleGrandTotalMoney}">${numVal(this.kpis.granTotalFacturado)}</td>
      <td style="${obtenerEstiloEstado('pagado', true)} font-size: 11pt;">${numVal(this.kpis.montoPagado)}</td>
      <td style="${obtenerEstiloEstado('pendiente', true)} font-size: 11pt;">${numVal(this.kpis.montoPendienteEnTiempo)}</td>
      <td style="${obtenerEstiloEstado('vencido', true)} font-size: 11pt;">${numVal(this.kpis.montoVencidoExigible)}</td>
    </tr>
    <tr height="18"><td colspan="10"></td></tr>

    <!-- SECCIÓN II: CONCENTRADO DE PAGO Y DISPERSIÓN POR PROVEEDOR -->
    <tr height="36" style="height: 27pt; mso-height-source: userset;">
      <td colspan="10" style="${styleSectionBanner}">
        II. CONCENTRADO DE PAGO Y DISPERSIÓN SEMANAL POR PROVEEDOR (${this.resumenProveedores.length} PROVEEDORES)
      </td>
    </tr>
    <tr height="36" style="height: 27pt; mso-height-source: userset;">
      <th style="${styleTh}">Código Proveedor</th>
      <th style="${styleTh}">RFC Emisor</th>
      <th style="${styleTh}">Razón Social Proveedor</th>
      <th style="${styleTh}">Régimen Fiscal Emisor</th>
      <th style="${styleTh}">Cant. Facturas</th>
      <th style="${styleTh}">Subtotal (MXN)</th>
      <th style="${styleTh}">Impuestos (MXN)</th>
      <th style="${styleTh}">Monto Pagado (MXN)</th>
      <th style="${styleTh}">Saldo Pendiente a Dispersar (MXN)</th>
      <th style="${styleTh}">Total Facturado (MXN)</th>
    </tr>
    ${filasProveedoresHtml}
    <tr height="36" style="height: 27pt; mso-height-source: userset;">
      <td colspan="4" style="${styleTotalLabel}">TOTALES POR PROVEEDORES:</td>
      <td style="${styleTotalLabel} text-align: center;">${this.kpis.totalCfdis}</td>
      <td style="${styleTotalMoney}">${numVal(this.kpis.subTotalAcumulado)}</td>
      <td style="${styleTotalMoney}">${numVal(this.kpis.impuestosTrasladados)}</td>
      <td style="${obtenerEstiloEstado('pagado', true)} border-top: 2px solid #0f2247; border-bottom: 2px solid #0f2247;">${numVal(this.kpis.montoPagado)}</td>
      <td style="${obtenerEstiloEstado('pendiente', true)} border-top: 2px solid #0f2247; border-bottom: 2px solid #0f2247;">${numVal(this.kpis.montoPendienteEnTiempo + this.kpis.montoVencidoExigible)}</td>
      <td style="${styleGrandTotalMoney}">${numVal(this.kpis.granTotalFacturado)}</td>
    </tr>
    <tr height="18"><td colspan="20"></td></tr>

    <!-- SECCIÓN III: CÉDULA DETALLADA DE COMPROBANTES CFDI 4.0 -->
    <tr height="36" style="height: 27pt; mso-height-source: userset;">
      <td colspan="20" style="${styleSectionBanner}">
        III. CÉDULA DETALLADA DE COMPROBANTES FISCALES DIGITALES CFDI 4.0 (${this.facturasFiltradas.length} REGISTROS)
      </td>
    </tr>
    <tr height="36" style="height: 27pt; mso-height-source: userset;">
      <th style="${styleTh}">Folio</th>
      <th style="${styleTh}">UUID Fiscal (Timbre SAT)</th>
      <th style="${styleTh}">Código Proveedor</th>
      <th style="${styleTh}">RFC Emisor</th>
      <th style="${styleTh}">Razón Social Emisor</th>
      <th style="${styleTh}">Régimen Emisor</th>
      <th style="${styleTh}">Régimen Receptor</th>
      <th style="${styleTh}">Uso CFDI</th>
      <th style="${styleTh}">Método Pago</th>
      <th style="${styleTh}">Forma Pago</th>
      <th style="${styleTh}">Condición Crédito</th>
      <th style="${styleTh}">Días Crédito</th>
      <th style="${styleTh}">Fecha Emisión CFDI</th>
      <th style="${styleTh}">Fecha Recepción XML</th>
      <th style="${styleTh}">Fecha Límite / Programada Pago</th>
      <th style="${styleTh}">Estatus de Plazo</th>
      <th style="${styleTh}">Subtotal (MXN)</th>
      <th style="${styleTh}">Impuestos Trasladados (MXN)</th>
      <th style="${styleTh}">Total (MXN)</th>
      <th style="${styleTh}">Estado Contable</th>
    </tr>
    ${filasFacturasHtml}
    <tr height="36" style="height: 27pt; mso-height-source: userset;">
      <td colspan="16" style="${styleTotalLabel}">
        SUMAS TOTALES DE LA CÉDULA (${this.facturasFiltradas.length} COMPROBANTES):
      </td>
      <td style="${styleTotalMoney}">${numVal(this.kpis.subTotalAcumulado)}</td>
      <td style="${styleTotalMoney}">${numVal(this.kpis.impuestosTrasladados)}</td>
      <td style="${styleGrandTotalMoney}">${numVal(this.kpis.granTotalFacturado)}</td>
      <td style="${styleTotalLabel}"></td>
    </tr>
  </table>
</body>
</html>`;

    const blob = new Blob([htmlExcel], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const sufijoFecha =
      this.fechaInicio && this.fechaFin
        ? `${this.fechaInicio}_a_${this.fechaFin}`
        : new Date().toISOString().split('T')[0];

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Cedula_Contable_XmlFlow_${sufijoFecha}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /** Dispara la impresión nativa / guardado como PDF con formato de póliza contable */
  imprimirReporte(): void {
    this.fechaHoraEmisionReporte = new Date();
    if (typeof window !== 'undefined') {
      window.print();
    }
  }
}
