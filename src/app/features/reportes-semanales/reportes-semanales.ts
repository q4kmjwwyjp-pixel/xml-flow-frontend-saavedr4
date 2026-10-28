import { Component, OnInit, inject, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import * as XLSXStyle from 'xlsx-js-style';
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

const XLSX: typeof XLSXStyle = (XLSXStyle as any).default || XLSXStyle;

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
   * Exporta la cédula completa a un archivo OpenXML binario real (.xlsx) con estilos nativos de Office
   * usando xlsx-js-style, 100% compatible tanto con Microsoft Excel para Android como con Excel de PC.
   */
  exportarCsvContabilidad(): void {
    const CURRENCY_FMT = '$#,##0.00';

    const borderThinSlate: XLSXStyle.CellStyle['border'] = {
      top: { style: 'thin', color: { rgb: 'CBD5E1' } },
      bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
      left: { style: 'thin', color: { rgb: 'CBD5E1' } },
      right: { style: 'thin', color: { rgb: 'CBD5E1' } },
    };

    const borderHeader: XLSXStyle.CellStyle['border'] = {
      top: { style: 'thin', color: { rgb: '94A3B8' } },
      bottom: { style: 'thin', color: { rgb: '94A3B8' } },
      left: { style: 'thin', color: { rgb: '94A3B8' } },
      right: { style: 'thin', color: { rgb: '94A3B8' } },
    };

    const borderBanner: XLSXStyle.CellStyle['border'] = {
      top: { style: 'thin', color: { rgb: '0F2247' } },
      bottom: { style: 'thin', color: { rgb: '0F2247' } },
      left: { style: 'thin', color: { rgb: '0F2247' } },
      right: { style: 'thin', color: { rgb: '0F2247' } },
    };

    const borderTotals: XLSXStyle.CellStyle['border'] = {
      top: { style: 'medium', color: { rgb: '0F2247' } },
      bottom: { style: 'medium', color: { rgb: '0F2247' } },
      left: { style: 'thin', color: { rgb: '94A3B8' } },
      right: { style: 'thin', color: { rgb: '94A3B8' } },
    };

    // Estilos corporativos principales
    const styleMembreteTitulo: XLSXStyle.CellStyle = {
      fill: { patternType: 'solid', fgColor: { rgb: '0F2247' } },
      font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'left', vertical: 'center', wrapText: false },
      border: borderBanner,
    };

    const styleMembreteSub: XLSXStyle.CellStyle = {
      fill: { patternType: 'solid', fgColor: { rgb: '0F2247' } },
      font: { name: 'Calibri', sz: 10.5, bold: true, color: { rgb: 'E2E8F0' } },
      alignment: { horizontal: 'left', vertical: 'center', wrapText: false },
      border: borderBanner,
    };

    const styleMetaLabel: XLSXStyle.CellStyle = {
      fill: { patternType: 'solid', fgColor: { rgb: 'E2E8F0' } },
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0F2247' } },
      alignment: { horizontal: 'left', vertical: 'center', wrapText: false },
      border: borderHeader,
    };

    const styleMetaVal: XLSXStyle.CellStyle = {
      fill: { patternType: 'solid', fgColor: { rgb: 'F8FAFC' } },
      font: { name: 'Calibri', sz: 10, bold: false, color: { rgb: '0F172A' } },
      alignment: { horizontal: 'left', vertical: 'center', wrapText: false },
      border: borderThinSlate,
    };

    const styleMetaValBold: XLSXStyle.CellStyle = {
      ...styleMetaVal,
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0F172A' } },
    };

    const styleMetaValAccent: XLSXStyle.CellStyle = {
      ...styleMetaVal,
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '1E3A8A' } },
    };

    const styleSectionBanner: XLSXStyle.CellStyle = {
      fill: { patternType: 'solid', fgColor: { rgb: '1E3A8A' } },
      font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'left', vertical: 'center', wrapText: false },
      border: borderBanner,
    };

    const styleTh: XLSXStyle.CellStyle = {
      fill: { patternType: 'solid', fgColor: { rgb: 'E2E8F0' } },
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0F2247' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: false },
      border: borderHeader,
    };

    const styleTdText: XLSXStyle.CellStyle = {
      fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } },
      font: { name: 'Calibri', sz: 10, bold: false, color: { rgb: '0F172A' } },
      alignment: { horizontal: 'left', vertical: 'center', wrapText: false },
      border: borderThinSlate,
    };

    const styleTdTextBold: XLSXStyle.CellStyle = {
      ...styleTdText,
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0F172A' } },
    };

    const styleTdUuid: XLSXStyle.CellStyle = {
      fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } },
      font: { name: 'Consolas', sz: 9.5, bold: false, color: { rgb: '0F172A' } },
      alignment: { horizontal: 'left', vertical: 'center', wrapText: false },
      border: borderThinSlate,
    };

    const styleTdCenter: XLSXStyle.CellStyle = {
      fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } },
      font: { name: 'Calibri', sz: 10, bold: false, color: { rgb: '0F172A' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: false },
      border: borderThinSlate,
    };

    const styleTdCenterBold: XLSXStyle.CellStyle = {
      ...styleTdCenter,
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0F172A' } },
    };

    const styleTdMoney: XLSXStyle.CellStyle = {
      fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } },
      font: { name: 'Calibri', sz: 10, bold: false, color: { rgb: '0F172A' } },
      alignment: { horizontal: 'right', vertical: 'center', wrapText: false },
      border: borderThinSlate,
      numFmt: CURRENCY_FMT,
    };

    const styleTdMoneyBold: XLSXStyle.CellStyle = {
      ...styleTdMoney,
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0F172A' } },
    };

    const styleTdMoneyHighlight: XLSXStyle.CellStyle = {
      fill: { patternType: 'solid', fgColor: { rgb: 'EFF6FF' } },
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '1E3A8A' } },
      alignment: { horizontal: 'right', vertical: 'center', wrapText: false },
      border: borderThinSlate,
      numFmt: CURRENCY_FMT,
    };

    const styleTotalLabel: XLSXStyle.CellStyle = {
      fill: { patternType: 'solid', fgColor: { rgb: 'E2E8F0' } },
      font: { name: 'Calibri', sz: 10.5, bold: true, color: { rgb: '0F2247' } },
      alignment: { horizontal: 'right', vertical: 'center', wrapText: false },
      border: borderTotals,
    };

    const styleTotalCenter: XLSXStyle.CellStyle = {
      ...styleTotalLabel,
      alignment: { horizontal: 'center', vertical: 'center', wrapText: false },
    };

    const styleTotalMoney: XLSXStyle.CellStyle = {
      fill: { patternType: 'solid', fgColor: { rgb: 'E2E8F0' } },
      font: { name: 'Calibri', sz: 10.5, bold: true, color: { rgb: '0F2247' } },
      alignment: { horizontal: 'right', vertical: 'center', wrapText: false },
      border: borderTotals,
      numFmt: CURRENCY_FMT,
    };

    const styleGrandTotalMoney: XLSXStyle.CellStyle = {
      fill: { patternType: 'solid', fgColor: { rgb: 'DBEAFE' } },
      font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '1E3A8A' } },
      alignment: { horizontal: 'right', vertical: 'center', wrapText: false },
      border: borderTotals,
      numFmt: CURRENCY_FMT,
    };

    // Estilos semánticos de estatus (PAGADO = DCFCE7/15803D, PENDIENTE = FEF3C7/B45309, VENCIDO = FEE2E2/B91C1C)
    const obtenerEstiloSemantico = (
      estado: 'pagado' | 'pendiente' | 'vencido',
      esMoneda: boolean = false,
      esFilaTotal: boolean = false
    ): XLSXStyle.CellStyle => {
      const colores =
        estado === 'pagado'
          ? { bg: 'DCFCE7', fg: '15803D' }
          : estado === 'vencido'
          ? { bg: 'FEE2E2', fg: 'B91C1C' }
          : { bg: 'FEF3C7', fg: 'B45309' };

      const style: XLSXStyle.CellStyle = {
        fill: { patternType: 'solid', fgColor: { rgb: colores.bg } },
        font: { name: 'Calibri', sz: esFilaTotal ? 10.5 : 10, bold: true, color: { rgb: colores.fg } },
        alignment: { horizontal: esMoneda ? 'right' : 'center', vertical: 'center', wrapText: false },
        border: esFilaTotal ? borderTotals : borderThinSlate,
      };
      if (esMoneda) {
        style.numFmt = CURRENCY_FMT;
      }
      return style;
    };

    // Constructores de celdas tipadas para AOA
    const strCell = (val: any, s: XLSXStyle.CellStyle): XLSXStyle.CellObject => ({
      v: val === null || val === undefined ? '' : String(val),
      t: 's',
      s,
    });

    const intCell = (val: number, s: XLSXStyle.CellStyle): XLSXStyle.CellObject => ({
      v: Number(val) || 0,
      t: 'n',
      s,
    });

    const moneyCell = (val: number, s: XLSXStyle.CellStyle): XLSXStyle.CellObject => ({
      v: Number((Number(val) || 0).toFixed(2)),
      t: 'n',
      z: CURRENCY_FMT,
      s,
    });

    const aoa: XLSXStyle.CellObject[][] = [];
    const rows: XLSXStyle.RowInfo[] = [];
    const merges: XLSXStyle.Range[] = [];

    const pushRow = (cells: XLSXStyle.CellObject[], hpt: number): number => {
      const idx = aoa.length;
      aoa.push(cells);
      rows.push({ hpt });
      return idx;
    };

    // Rellena un rango combinado aplicando el mismo estilo en todas las celdas del merge para mantener bordes uniformes
    const pushMergedBanner = (texto: string, colSpan: number, style: XLSXStyle.CellStyle, hpt: number): void => {
      const rowCells: XLSXStyle.CellObject[] = [strCell(texto, style)];
      for (let c = 1; c < colSpan; c++) {
        rowCells.push(strCell('', style));
      }
      const rIdx = pushRow(rowCells, hpt);
      merges.push({ s: { r: rIdx, c: 0 }, e: { r: rIdx, c: colSpan - 1 } });
    };

    // =========================================================================
    // ENCABEZADO / MEMBRETE CORPORATIVO
    // =========================================================================
    pushMergedBanner(
      'TRANSPORTES DE LOS SANTOS E HIJOS — CÉDULA CONTABLE Y DE TESORERÍA (CFDI 4.0)',
      10,
      styleMembreteTitulo,
      32
    );

    pushMergedBanner(
      'RFC Receptor: TSH7311116TL4  |  Régimen Fiscal: 624 - Coordinados  |  Uso CFDI Autorizado: G03 - Gastos en general',
      10,
      styleMembreteSub,
      26
    );

    const metaRowIdx = pushRow(
      [
        strCell('Folio de Reporte:', styleMetaLabel),
        strCell(this.folioReporte, styleMetaValBold),
        strCell('Fecha y Hora de Emisión:', styleMetaLabel),
        strCell(this.fechaHoraEmisionReporte.toLocaleString('es-MX'), styleMetaVal),
        strCell('Criterio de Periodo:', styleMetaLabel),
        strCell(this.etiquetaCriterioFecha, styleMetaValBold),
        strCell('', styleMetaValBold),
        strCell('Rango Consultado:', styleMetaLabel),
        strCell(this.etiquetaRangoPeriodo, styleMetaValAccent),
        strCell('', styleMetaValAccent),
      ],
      26
    );
    merges.push(
      { s: { r: metaRowIdx, c: 5 }, e: { r: metaRowIdx, c: 6 } },
      { s: { r: metaRowIdx, c: 8 }, e: { r: metaRowIdx, c: 9 } }
    );

    pushRow([], 14);

    // =========================================================================
    // SECCIÓN I: RESUMEN FINANCIERO Y FLUJO DE EFECTIVO
    // =========================================================================
    pushMergedBanner('I. RESUMEN FINANCIERO, FISCAL Y DE FLUJO DE EFECTIVO DEL PERIODO', 7, styleSectionBanner, 28);

    pushRow(
      [
        strCell('Total CFDIs', styleTh),
        strCell('Subtotal Acumulado (MXN)', styleTh),
        strCell('Impuestos Trasladados Est. (MXN)', styleTh),
        strCell('Gran Total Facturado (MXN)', styleTh),
        strCell('Monto Pagado / Liquidado (MXN)', styleTh),
        strCell('Monto Pendiente en Tiempo (MXN)', styleTh),
        strCell('Monto Vencido / Exigible (MXN)', styleTh),
      ],
      26
    );

    pushRow(
      [
        intCell(this.kpis.totalCfdis, styleTdCenterBold),
        moneyCell(this.kpis.subTotalAcumulado, styleTdMoneyBold),
        moneyCell(this.kpis.impuestosTrasladados, styleTdMoneyBold),
        moneyCell(this.kpis.granTotalFacturado, styleGrandTotalMoney),
        moneyCell(this.kpis.montoPagado, obtenerEstiloSemantico('pagado', true, false)),
        moneyCell(this.kpis.montoPendienteEnTiempo, obtenerEstiloSemantico('pendiente', true, false)),
        moneyCell(this.kpis.montoVencidoExigible, obtenerEstiloSemantico('vencido', true, false)),
      ],
      26
    );

    pushRow([], 14);

    // =========================================================================
    // SECCIÓN II: CONCENTRADO DE PAGO Y DISPERSIÓN POR PROVEEDOR
    // =========================================================================
    pushMergedBanner(
      `II. CONCENTRADO DE PAGO Y DISPERSIÓN SEMANAL POR PROVEEDOR (${this.resumenProveedores.length} PROVEEDORES)`,
      10,
      styleSectionBanner,
      28
    );

    pushRow(
      [
        strCell('Código Proveedor', styleTh),
        strCell('RFC Emisor', styleTh),
        strCell('Razón Social Proveedor', styleTh),
        strCell('Régimen Fiscal Emisor', styleTh),
        strCell('Cant. Facturas', styleTh),
        strCell('Subtotal (MXN)', styleTh),
        strCell('Impuestos (MXN)', styleTh),
        strCell('Monto Pagado (MXN)', styleTh),
        strCell('Saldo Pendiente a Dispersar (MXN)', styleTh),
        strCell('Total Facturado (MXN)', styleTh),
      ],
      26
    );

    for (const p of this.resumenProveedores) {
      pushRow(
        [
          strCell(p.codigoProveedor, styleTdCenterBold),
          strCell(p.rfc, styleTdCenter),
          strCell(p.nombre, styleTdTextBold),
          strCell(this.describirRegimen(p.regimenFiscal), styleTdText),
          intCell(p.cantidadFacturas, styleTdCenterBold),
          moneyCell(p.subTotal, styleTdMoney),
          moneyCell(p.impuestos, styleTdMoney),
          moneyCell(p.montoPagado, obtenerEstiloSemantico('pagado', true, false)),
          moneyCell(
            p.saldoPendiente,
            p.saldoPendiente > 0 ? obtenerEstiloSemantico('pendiente', true, false) : styleTdMoneyHighlight
          ),
          moneyCell(p.total, styleTdMoneyBold),
        ],
        24
      );
    }

    const totalProvRowIdx = pushRow(
      [
        strCell('TOTALES POR PROVEEDORES:', styleTotalLabel),
        strCell('', styleTotalLabel),
        strCell('', styleTotalLabel),
        strCell('', styleTotalLabel),
        intCell(this.kpis.totalCfdis, styleTotalCenter),
        moneyCell(this.kpis.subTotalAcumulado, styleTotalMoney),
        moneyCell(this.kpis.impuestosTrasladados, styleTotalMoney),
        moneyCell(this.kpis.montoPagado, obtenerEstiloSemantico('pagado', true, true)),
        moneyCell(
          this.kpis.montoPendienteEnTiempo + this.kpis.montoVencidoExigible,
          obtenerEstiloSemantico('pendiente', true, true)
        ),
        moneyCell(this.kpis.granTotalFacturado, styleGrandTotalMoney),
      ],
      26
    );
    merges.push({ s: { r: totalProvRowIdx, c: 0 }, e: { r: totalProvRowIdx, c: 3 } });

    pushRow([], 14);

    // =========================================================================
    // SECCIÓN III: CÉDULA DETALLADA DE COMPROBANTES CFDI 4.0
    // =========================================================================
    pushMergedBanner(
      `III. CÉDULA DETALLADA DE COMPROBANTES FISCALES DIGITALES CFDI 4.0 (${this.facturasFiltradas.length} REGISTROS)`,
      20,
      styleSectionBanner,
      28
    );

    pushRow(
      [
        strCell('Folio', styleTh),
        strCell('UUID Fiscal (Timbre SAT)', styleTh),
        strCell('Código Proveedor', styleTh),
        strCell('RFC Emisor', styleTh),
        strCell('Razón Social Emisor', styleTh),
        strCell('Régimen Emisor', styleTh),
        strCell('Régimen Receptor', styleTh),
        strCell('Uso CFDI', styleTh),
        strCell('Método Pago', styleTh),
        strCell('Forma Pago', styleTh),
        strCell('Condición Crédito', styleTh),
        strCell('Días Crédito', styleTh),
        strCell('Fecha Emisión CFDI', styleTh),
        strCell('Fecha Recepción XML', styleTh),
        strCell('Fecha Límite / Programada Pago', styleTh),
        strCell('Estatus de Plazo', styleTh),
        strCell('Subtotal (MXN)', styleTh),
        strCell('Impuestos Trasladados (MXN)', styleTh),
        strCell('Total (MXN)', styleTh),
        strCell('Estado Contable', styleTh),
      ],
      26
    );

    for (const f of this.facturasFiltradas) {
      const sub = this.obtenerSubtotal(f);
      const imp = this.obtenerImpuestos(f);
      const tot = Number(f.total || 0);
      const estadoEf = this.obtenerEstadoEfectivo(f);
      const plazo = this.obtenerEstatusPlazo(f).texto;
      const estiloEstadoTexto = obtenerEstiloSemantico(estadoEf, false, false);

      pushRow(
        [
          strCell(f.folio || '', styleTdCenterBold),
          strCell(f.uuid || 'N/A', styleTdUuid),
          strCell(f.codigoProveedor || '', styleTdCenter),
          strCell(f.rfcEmisor || '', styleTdCenter),
          strCell(f.nombreProveedor || '', styleTdTextBold),
          strCell(this.describirRegimen(f.regimenEmisor), styleTdText),
          strCell(this.describirRegimen(f.regimenReceptor), styleTdText),
          strCell(this.describirUsoCfdi(f.usoCfdi), styleTdText),
          strCell(this.describirMetodoPago(f.metodoPago), styleTdText),
          strCell(this.describirFormaPago(f.formaPago), styleTdText),
          strCell(f.metodoPago === 'PPD' ? 'Crédito (PPD)' : 'Contado (PUE)', styleTdCenter),
          intCell(f.diasCredito || 0, styleTdCenter),
          strCell(f.fechaEmision || '', styleTdCenter),
          strCell(f.fechaRevision || '', styleTdCenter),
          strCell(f.fechaProgramacionPago || f.fechaEmision || '', styleTdCenterBold),
          strCell(plazo, estiloEstadoTexto),
          moneyCell(sub, styleTdMoney),
          moneyCell(imp, styleTdMoney),
          moneyCell(tot, styleTdMoneyBold),
          strCell(estadoEf.toUpperCase(), estiloEstadoTexto),
        ],
        24
      );
    }

    const totalCedulaCells: XLSXStyle.CellObject[] = [
      strCell(`SUMAS TOTALES DE LA CÉDULA (${this.facturasFiltradas.length} COMPROBANTES):`, styleTotalLabel),
    ];
    for (let c = 1; c <= 15; c++) {
      totalCedulaCells.push(strCell('', styleTotalLabel));
    }
    totalCedulaCells.push(
      moneyCell(this.kpis.subTotalAcumulado, styleTotalMoney),
      moneyCell(this.kpis.impuestosTrasladados, styleTotalMoney),
      moneyCell(this.kpis.granTotalFacturado, styleGrandTotalMoney),
      strCell('', styleTotalLabel)
    );
    const totalCedulaRowIdx = pushRow(totalCedulaCells, 26);
    merges.push({ s: { r: totalCedulaRowIdx, c: 0 }, e: { r: totalCedulaRowIdx, c: 15 } });

    // Construcción de la hoja y configuración de anchos amplios para las 20 columnas (sin recortes en móvil ni PC)
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = merges;
    ws['!rows'] = rows;
    ws['!cols'] = [
      { wch: 22 }, // Col 1: Folio / Código Proveedor / Total CFDIs
      { wch: 42 }, // Col 2: UUID Fiscal (36 chars) / RFC Emisor / Subtotal Acumulado
      { wch: 40 }, // Col 3: Razón Social Proveedor / Código Prov / Impuestos Trasladados
      { wch: 36 }, // Col 4: RFC Emisor / Régimen Fiscal / Gran Total Facturado
      { wch: 42 }, // Col 5: Razón Social Emisor / Cant. Facturas / Monto Pagado
      { wch: 38 }, // Col 6: Régimen Emisor / Subtotal Prov / Monto Pendiente
      { wch: 34 }, // Col 7: Régimen Receptor / Impuestos Prov / Monto Vencido
      { wch: 34 }, // Col 8: Uso CFDI / Monto Pagado Prov
      { wch: 36 }, // Col 9: Método Pago / Saldo Pendiente a Dispersar
      { wch: 36 }, // Col 10: Forma Pago / Total Facturado Prov
      { wch: 20 }, // Col 11: Condición Crédito
      { wch: 16 }, // Col 12: Días Crédito
      { wch: 22 }, // Col 13: Fecha Emisión CFDI
      { wch: 22 }, // Col 14: Fecha Recepción XML
      { wch: 30 }, // Col 15: Fecha Límite / Programada Pago
      { wch: 28 }, // Col 16: Estatus de Plazo
      { wch: 22 }, // Col 17: Subtotal (MXN)
      { wch: 26 }, // Col 18: Impuestos Trasladados (MXN)
      { wch: 22 }, // Col 19: Total (MXN)
      { wch: 20 }, // Col 20: Estado Contable
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cedula Contable CFDI 4.0');

    const sufijoFecha =
      this.fechaInicio && this.fechaFin
        ? `${this.fechaInicio}_a_${this.fechaFin}`
        : new Date().toISOString().split('T')[0];

    const nombreArchivo = `Cedula_Contable_XmlFlow_${sufijoFecha}.xlsx`;
    const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    // 1. Soporte nativo para APK de Android (puente JavascriptInterface en MainActivity.java)
    const androidNative = typeof window !== 'undefined' ? (window as any).AndroidNative : null;
    if (androidNative && typeof androidNative.saveBase64File === 'function') {
      const base64Data: string = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
      androidNative.saveBase64File(base64Data, nombreArchivo, mimeType);
      return;
    }

    const excelBuffer: ArrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: mimeType });

    // 2. Segundo método para navegadores móviles/tablets (Web Share API con archivos)
    const esMovilOTablet =
      typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
    if (
      esMovilOTablet &&
      typeof navigator !== 'undefined' &&
      typeof navigator.canShare === 'function' &&
      typeof navigator.share === 'function'
    ) {
      try {
        const archivoCompartir = new File([blob], nombreArchivo, { type: mimeType });
        if (navigator.canShare({ files: [archivoCompartir] })) {
          navigator
            .share({
              files: [archivoCompartir],
              title: nombreArchivo,
              text: 'Cédula Contable y de Tesorería CFDI 4.0',
            })
            .catch((err) => console.warn('Compartir cancelado o no disponible:', err));
          return;
        }
      } catch (e) {
        console.warn('Fallback a descarga directa:', e);
      }
    }

    // 3. Descarga directa tradicional en navegador de PC
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', nombreArchivo);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /** Dispara la impresión nativa / guardado como PDF con formato de póliza contable (PC y APK Android) */
  imprimirReporte(): void {
    this.fechaHoraEmisionReporte = new Date();
    if (typeof window === 'undefined') return;

    const sufijoFecha =
      this.fechaInicio && this.fechaFin
        ? `${this.fechaInicio}_a_${this.fechaFin}`
        : new Date().toISOString().split('T')[0];

    const androidNative = (window as any).AndroidNative;
    if (androidNative && typeof androidNative.printPage === 'function') {
      androidNative.printPage(`Cedula_Contable_XmlFlow_${sufijoFecha}`);
      return;
    }

    window.print();
  }
}
