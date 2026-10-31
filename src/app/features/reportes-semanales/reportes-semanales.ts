import {
  Component,
  OnInit,
  inject,
  signal,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import * as XLSXStyle from 'xlsx-js-style';
import { FacturaService } from '../../core/services/factura.service';
import { AuthService } from '../../core/services/auth.service';
import { FacturaResumen } from '../../core/models/factura.model';
import { calcularVencimiento } from '../../core/utils/factura-vencimiento';

const XLSX: typeof XLSXStyle = (XLSXStyle as any).default || XLSXStyle;

export type CriterioFecha = 'programacion' | 'emision' | 'recepcion';
export type PeriodoRapido =
  | 'ESTA_SEMANA'
  | 'SEMANA_PASADA'
  | 'PROXIMA_SEMANA'
  | 'ESTE_MES'
  | 'TODO'
  | 'PERSONALIZADO';

export interface FilaVistaPrevia {
  factura: FacturaResumen;
  folioContrarrecibo: string;
  claveProveedor: string;
  razonSocial: string;
  rfc: string;
  folioFactura: string;
  fechaProgramada: string;
  montoTotal: number;
  monedaCodigo: 'MXN' | 'USD';
  monedaEtiqueta: 'Pesos (MXN)' | 'Dólares (USD)';
  indiceGrupo: number;
  esInicioGrupo: boolean;
  esFinGrupo: boolean;
  tamanoGrupo: number;
  posicionEnGrupo: number;
  subtotalGrupo: number;
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
  public readonly authService = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);

  cargando = signal<boolean>(true);
  errorCarga = signal<string | null>(null);

  todasLasFacturas: FacturaResumen[] = [];
  facturasFiltradas: FacturaResumen[] = [];
  filasVistaPrevia: FilaVistaPrevia[] = [];

  // Filtros superiores conservados + soporte de moneda y contrarrecibo
  criterioFecha: CriterioFecha = 'programacion';
  periodoActivo: PeriodoRapido = 'ESTA_SEMANA';
  fechaInicio: string = '';
  fechaFin: string = '';
  filtroEstado: string = 'TODOS';
  filtroCondicion: string = 'TODAS';
  filtroMoneda: string = 'TODAS';
  filtroContrarrecibo: 'CON_CONTRARRECIBO' | 'TODAS' = 'CON_CONTRARRECIBO';
  ordenFolio: 'asc' | 'desc' = 'asc';
  filtroProveedorRfc: string = 'TODOS';
  busquedaTexto: string = '';

  // Totales de la vista previa
  totalMontoMxn: number = 0;
  totalMontoUsd: number = 0;
  totalGruposContrarrecibo: number = 0;

  ngOnInit(): void {
    this.seleccionarPeriodoRapido('ESTA_SEMANA', false);
    this.cargarFacturas();
  }

  cargarFacturas(): void {
    this.cargando.set(true);
    this.errorCarga.set(null);

    this.facturaService.getReporteSemanal().subscribe({
      next: (reporte) => {
        this.todasLasFacturas = reporte?.facturas || [];
        this.aplicarFiltros();

        if (
          this.facturasFiltradas.length === 0 &&
          this.todasLasFacturas.length > 0
        ) {
          this.seleccionarPeriodoRapido('TODO', true);
        }

        this.cargando.set(false);
        this.cdr.detectChanges();
      },
      error: () => {
        this.facturaService.getFacturas().subscribe({
          next: (facturas) => {
            this.todasLasFacturas = facturas || [];
            this.aplicarFiltros();

            if (
              this.facturasFiltradas.length === 0 &&
              this.todasLasFacturas.length > 0
            ) {
              this.seleccionarPeriodoRapido('TODO', true);
            }

            this.cargando.set(false);
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('Error al cargar facturas para el reporte:', err);
            this.errorCarga.set(
              'No se pudieron obtener los comprobantes del servidor. Verifica tu conexión.'
            );
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
      if (!this.authService.debeMostrarFactura(f)) continue;
      if (f.rfcEmisor && !mapa.has(f.rfcEmisor)) {
        mapa.set(f.rfcEmisor, f.nombreProveedor || f.rfcEmisor);
      }
    }
    return Array.from(mapa.entries())
      .map(([rfc, nombre]) => ({ rfc, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  alternarVistaPruebas(): void {
    this.authService.toggleMostrarDatosPrueba();
    this.aplicarFiltros();
  }

  /** Configura las fechas de inicio y fin según el botón rápido seleccionado */
  seleccionarPeriodoRapido(
    periodo: PeriodoRapido,
    recalcular: boolean = true
  ): void {
    this.periodoActivo = periodo;
    const hoy = new Date();
    const diaSemana = hoy.getDay();
    const diffLunes = diaSemana === 0 ? -6 : 1 - diaSemana;

    const lunesEstaSemana = new Date(
      hoy.getFullYear(),
      hoy.getMonth(),
      hoy.getDate() + diffLunes
    );

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
    this.filtroMoneda = 'TODAS';
    this.filtroContrarrecibo = 'CON_CONTRARRECIBO';
    this.ordenFolio = 'asc';
    this.filtroProveedorRfc = 'TODOS';
    this.busquedaTexto = '';
    this.seleccionarPeriodoRapido('TODO', true);
  }

  obtenerFechaPorCriterio(f: FacturaResumen): string {
    if (this.criterioFecha === 'programacion') {
      return (
        f.fechaProgramacionPago || f.fechaEmision || f.fechaRevision || ''
      );
    }
    if (this.criterioFecha === 'emision') {
      return f.fechaEmision || f.fechaRevision || '';
    }
    return f.fechaRevision || f.fechaEmision || '';
  }

  obtenerEstadoEfectivo(f: FacturaResumen): 'pagado' | 'pendiente' | 'vencido' {
    const est = (f.estado || 'pendiente').toLowerCase();
    if (est === 'pagado') return 'pagado';
    if (est === 'vencido') return 'vencido';
    const infoVenc = calcularVencimiento(f);
    if (infoVenc.vencida) return 'vencido';
    return 'pendiente';
  }

  obtenerMonedaCodigo(f: FacturaResumen): 'MXN' | 'USD' {
    const m = (f.moneda || 'MXN').trim().toUpperCase();
    return m === 'USD' || m === 'DOLARES' || m === 'DÓLARES' ? 'USD' : 'MXN';
  }

  obtenerMonedaEtiqueta(f: FacturaResumen): 'Pesos (MXN)' | 'Dólares (USD)' {
    return this.obtenerMonedaCodigo(f) === 'USD'
      ? 'Dólares (USD)'
      : 'Pesos (MXN)';
  }

  formatearFechaLatam(fechaIso?: string): string {
    if (!fechaIso) return 'Sin programar';
    const limpio = fechaIso.split('T')[0];
    const partes = limpio.split('-');
    if (partes.length === 3) {
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return limpio;
  }

  aplicarFiltros(): void {
    const texto = (this.busquedaTexto || '').trim().toLowerCase();

    this.facturasFiltradas = this.todasLasFacturas.filter((f) => {
      // 0. Filtro de rol (Daniela no ve XMLs de prueba; Admin según su interruptor)
      if (!this.authService.debeMostrarFactura(f)) {
        return false;
      }

      // 1. Filtro por Folio de Contrarrecibo asignado (o según el filtro activo)
      const tieneContrarrecibo =
        !!f.folioContrarrecibo && f.folioContrarrecibo.trim().length > 0;
      if (
        this.filtroContrarrecibo === 'CON_CONTRARRECIBO' &&
        !tieneContrarrecibo
      ) {
        return false;
      }

      // 2. Filtro por rango de fechas según el criterio
      const fechaFactura = this.obtenerFechaPorCriterio(f);
      if (
        this.fechaInicio &&
        (!fechaFactura || fechaFactura < this.fechaInicio)
      ) {
        return false;
      }
      if (this.fechaFin && (!fechaFactura || fechaFactura > this.fechaFin)) {
        return false;
      }

      // 3. Filtro por estado
      if (this.filtroEstado !== 'TODOS') {
        const estadoEfectivo = this.obtenerEstadoEfectivo(f);
        const estadoBD = (f.estado || 'pendiente').toLowerCase();
        if (this.filtroEstado === 'vencido') {
          if (estadoEfectivo !== 'vencido' && estadoBD !== 'vencido')
            return false;
        } else if (this.filtroEstado === 'pendiente') {
          if (estadoEfectivo !== 'pendiente') return false;
        } else if (this.filtroEstado === 'pagado') {
          if (estadoEfectivo !== 'pagado') return false;
        }
      }

      // 4. Filtro por condición / método de pago
      if (
        this.filtroCondicion !== 'TODAS' &&
        f.metodoPago !== this.filtroCondicion
      ) {
        return false;
      }

      // 5. Filtro por moneda (MXN / USD)
      if (
        this.filtroMoneda !== 'TODAS' &&
        this.obtenerMonedaCodigo(f) !== this.filtroMoneda
      ) {
        return false;
      }

      // 6. Filtro por proveedor
      if (
        this.filtroProveedorRfc !== 'TODOS' &&
        f.rfcEmisor !== this.filtroProveedorRfc
      ) {
        return false;
      }

      // 7. Filtro por búsqueda de texto (Folio Contrarrecibo, Factura, UUID, Proveedor, RFC)
      if (texto) {
        const coincide =
          (f.folioContrarrecibo || '').toLowerCase().includes(texto) ||
          (f.folio || '').toLowerCase().includes(texto) ||
          (f.uuid || '').toLowerCase().includes(texto) ||
          (f.nombreProveedor || '').toLowerCase().includes(texto) ||
          (f.rfcEmisor || '').toLowerCase().includes(texto) ||
          (f.codigoProveedor || '').toLowerCase().includes(texto);
        if (!coincide) return false;
      }

      return true;
    });

    // Ordenar prioritariamente por Folio de Contrarrecibo ASC/DESC y después por Fecha Programada de Pago
    this.facturasFiltradas.sort((a, b) => {
      const folioA = (a.folioContrarrecibo || '').trim();
      const folioB = (b.folioContrarrecibo || '').trim();

      if (folioA && !folioB) return -1;
      if (!folioA && folioB) return 1;

      if (folioA !== folioB) {
        const cmp = folioA.localeCompare(folioB, 'es', { numeric: true });
        return this.ordenFolio === 'desc' ? -cmp : cmp;
      }

      const fa = a.fechaProgramacionPago || a.fechaEmision || '9999-12-31';
      const fb = b.fechaProgramacionPago || b.fechaEmision || '9999-12-31';
      return fa.localeCompare(fb);
    });

    this.construirVistaPreviaAgrupada();
  }

  private construirVistaPreviaAgrupada(): void {
    const conteoPorFolio = new Map<string, number>();
    const sumaPorFolio = new Map<string, number>();

    for (const f of this.facturasFiltradas) {
      const key = (f.folioContrarrecibo || 'SIN-FOLIO').trim().toUpperCase();
      conteoPorFolio.set(key, (conteoPorFolio.get(key) || 0) + 1);
      sumaPorFolio.set(
        key,
        Number(((sumaPorFolio.get(key) || 0) + Number(f.total || 0)).toFixed(2))
      );
    }

    let indiceGrupoActual = -1;
    let claveGrupoAnterior = '';
    let posActual = 0;

    let sumaMxn = 0;
    let sumaUsd = 0;
    const foliosUnicos = new Set<string>();

    const filas: FilaVistaPrevia[] = [];

    for (let i = 0; i < this.facturasFiltradas.length; i++) {
      const f = this.facturasFiltradas[i];
      const folioCr = (f.folioContrarrecibo || '').trim() || 'S/F';
      const keyGrupo = folioCr.toUpperCase();

      if (folioCr !== 'S/F') {
        foliosUnicos.add(keyGrupo);
      }

      const esInicioGrupo = keyGrupo !== claveGrupoAnterior;
      if (esInicioGrupo) {
        indiceGrupoActual++;
        claveGrupoAnterior = keyGrupo;
        posActual = 1;
      } else {
        posActual++;
      }

      const tamanoGrupo = conteoPorFolio.get(keyGrupo) || 1;
      const esFinGrupo = posActual === tamanoGrupo;
      const monedaCodigo = this.obtenerMonedaCodigo(f);
      const montoTotal = Number(f.total || 0);

      if (monedaCodigo === 'USD') {
        sumaUsd += montoTotal;
      } else {
        sumaMxn += montoTotal;
      }

      const claveProvLimpia = (f.codigoProveedor || '')
        .replace(/^#/, '')
        .trim();

      filas.push({
        factura: f,
        folioContrarrecibo: folioCr,
        claveProveedor: claveProvLimpia || 'S/N',
        razonSocial: f.nombreProveedor || 'Proveedor Desconocido',
        rfc: f.rfcEmisor || 'SIN-RFC',
        folioFactura: f.folio || f.uuid || 'S/F',
        fechaProgramada: f.fechaProgramacionPago || f.fechaEmision || '',
        montoTotal,
        monedaCodigo,
        monedaEtiqueta: this.obtenerMonedaEtiqueta(f),
        indiceGrupo: indiceGrupoActual,
        esInicioGrupo,
        esFinGrupo,
        tamanoGrupo,
        posicionEnGrupo: posActual,
        subtotalGrupo: sumaPorFolio.get(keyGrupo) || montoTotal,
      });
    }

    this.filasVistaPrevia = filas;
    this.totalMontoMxn = Number(sumaMxn.toFixed(2));
    this.totalMontoUsd = Number(sumaUsd.toFixed(2));
    this.totalGruposContrarrecibo = foliosUnicos.size;
  }

  private formatearIsoLocal(fecha: Date): string {
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * Exporta a Excel (.xlsx) respetando exactamente la estructura, columnas y orden de la Vista Previa:
   * Facturas agrupadas por Folio de Contrarrecibo, 7 columnas limpias (sin RFC) y formateo numérico de moneda y fechas.
   */
  exportarExcel(): void {
    if (this.filasVistaPrevia.length === 0) return;

    const CURRENCY_FMT = '$#,##0.00';

    const borderHeader: XLSXStyle.CellStyle['border'] = {
      top: { style: 'medium', color: { rgb: '0F172A' } },
      bottom: { style: 'medium', color: { rgb: '0F172A' } },
      left: { style: 'thin', color: { rgb: '334155' } },
      right: { style: 'thin', color: { rgb: '334155' } },
    };

    const styleHeader: XLSXStyle.CellStyle = {
      fill: { patternType: 'solid', fgColor: { rgb: '0F172A' } },
      font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: false },
      border: borderHeader,
    };

    const crearBordeFila = (
      esInicioGrupo: boolean,
      esFinGrupo: boolean
    ): XLSXStyle.CellStyle['border'] => ({
      top: esInicioGrupo
        ? { style: 'medium', color: { rgb: '6366F1' } }
        : { style: 'thin', color: { rgb: 'CBD5E1' } },
      bottom: esFinGrupo
        ? { style: 'medium', color: { rgb: '94A3B8' } }
        : { style: 'thin', color: { rgb: 'CBD5E1' } },
      left: { style: 'thin', color: { rgb: 'CBD5E1' } },
      right: { style: 'thin', color: { rgb: 'CBD5E1' } },
    });

    const strCell = (
      val: any,
      s: XLSXStyle.CellStyle
    ): XLSXStyle.CellObject => ({
      v: val === null || val === undefined ? '' : String(val),
      t: 's',
      s,
    });

    const moneyCell = (
      val: number,
      s: XLSXStyle.CellStyle
    ): XLSXStyle.CellObject => ({
      v: Number((Number(val) || 0).toFixed(2)),
      t: 'n',
      z: CURRENCY_FMT,
      s,
    });

    const aoa: XLSXStyle.CellObject[][] = [];
    const rows: XLSXStyle.RowInfo[] = [];

    // Encabezado exacto de las 7 columnas de la Vista Previa (sin RFC)
    aoa.push([
      strCell('N° Proveedor (Clave)', styleHeader),
      strCell('Nombre del Proveedor', styleHeader),
      strCell('Folio Contrarrecibo', styleHeader),
      strCell('Factura (Serie/Folio)', styleHeader),
      strCell('Fecha Programada de Pago', styleHeader),
      strCell('Monto / Total', styleHeader),
      strCell('Moneda', styleHeader),
    ]);
    rows.push({ hpt: 28 });

    // Filas de datos respetando el orden: N° Proveedor, Nombre del Proveedor, Folio Contrarrecibo...
    for (const fila of this.filasVistaPrevia) {
      const bgHex = fila.indiceGrupo % 2 === 0 ? 'FFFFFF' : 'EEF2FF';
      const border = crearBordeFila(fila.esInicioGrupo, fila.esFinGrupo);

      const styleCenterBold: XLSXStyle.CellStyle = {
        fill: { patternType: 'solid', fgColor: { rgb: bgHex } },
        font: { name: 'Calibri', sz: 10.5, bold: true, color: { rgb: '1E1B4B' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border,
      };

      const styleCenter: XLSXStyle.CellStyle = {
        fill: { patternType: 'solid', fgColor: { rgb: bgHex } },
        font: { name: 'Calibri', sz: 10, bold: false, color: { rgb: '0F172A' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border,
      };

      const styleLeftBold: XLSXStyle.CellStyle = {
        fill: { patternType: 'solid', fgColor: { rgb: bgHex } },
        font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0F172A' } },
        alignment: { horizontal: 'left', vertical: 'center' },
        border,
      };

      const styleMoney: XLSXStyle.CellStyle = {
        fill: { patternType: 'solid', fgColor: { rgb: bgHex } },
        font: { name: 'Calibri', sz: 10.5, bold: true, color: { rgb: '0F172A' } },
        alignment: { horizontal: 'right', vertical: 'center' },
        border,
        numFmt: CURRENCY_FMT,
      };

      aoa.push([
        strCell(fila.claveProveedor, styleCenterBold),
        strCell(fila.razonSocial, styleLeftBold),
        strCell(fila.folioContrarrecibo, styleCenterBold),
        strCell(fila.folioFactura, styleCenterBold),
        strCell(this.formatearFechaLatam(fila.fechaProgramada), styleCenter),
        moneyCell(fila.montoTotal, styleMoney),
        strCell(fila.monedaEtiqueta, styleCenter),
      ]);
      rows.push({ hpt: 24 });
    }

    // Fila de Totales al final
    const borderTotal: XLSXStyle.CellStyle['border'] = {
      top: { style: 'medium', color: { rgb: '0F172A' } },
      bottom: { style: 'medium', color: { rgb: '0F172A' } },
      left: { style: 'thin', color: { rgb: '94A3B8' } },
      right: { style: 'thin', color: { rgb: '94A3B8' } },
    };

    const styleTotalLabel: XLSXStyle.CellStyle = {
      fill: { patternType: 'solid', fgColor: { rgb: 'E2E8F0' } },
      font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '0F172A' } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border: borderTotal,
    };

    const styleTotalMoney: XLSXStyle.CellStyle = {
      fill: { patternType: 'solid', fgColor: { rgb: 'DBEAFE' } },
      font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '1E3A8A' } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border: borderTotal,
      numFmt: CURRENCY_FMT,
    };

    const styleTotalCurrency: XLSXStyle.CellStyle = {
      fill: { patternType: 'solid', fgColor: { rgb: 'E2E8F0' } },
      font: { name: 'Calibri', sz: 10.5, bold: true, color: { rgb: '0F172A' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: borderTotal,
    };

    if (this.totalMontoMxn > 0 || this.totalMontoUsd === 0) {
      aoa.push([
        strCell('', styleTotalLabel),
        strCell('', styleTotalLabel),
        strCell('', styleTotalLabel),
        strCell('', styleTotalLabel),
        strCell(
          `TOTAL (${this.filasVistaPrevia.length} FACTURAS):`,
          styleTotalLabel
        ),
        moneyCell(this.totalMontoMxn, styleTotalMoney),
        strCell('Pesos (MXN)', styleTotalCurrency),
      ]);
      rows.push({ hpt: 26 });
    }

    if (this.totalMontoUsd > 0) {
      aoa.push([
        strCell('', styleTotalLabel),
        strCell('', styleTotalLabel),
        strCell('', styleTotalLabel),
        strCell('', styleTotalLabel),
        strCell('TOTAL DÓLARES:', styleTotalLabel),
        moneyCell(this.totalMontoUsd, styleTotalMoney),
        strCell('Dólares (USD)', styleTotalCurrency),
      ]);
      rows.push({ hpt: 26 });
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!rows'] = rows;
    ws['!cols'] = [
      { wch: 20 }, // 1. N° Proveedor (Clave)
      { wch: 44 }, // 2. Nombre del Proveedor
      { wch: 22 }, // 3. Folio Contrarrecibo
      { wch: 22 }, // 4. Factura (Serie/Folio)
      { wch: 26 }, // 5. Fecha Programada de Pago
      { wch: 20 }, // 6. Monto / Total
      { wch: 18 }, // 7. Moneda
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte Contrarrecibos');

    const sufijoFecha =
      this.fechaInicio && this.fechaFin
        ? `${this.fechaInicio}_a_${this.fechaFin}`
        : new Date().toISOString().split('T')[0];

    const nombreArchivo = `Reporte_Contrarrecibos_Vexel_${sufijoFecha}.xlsx`;
    const mimeType =
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    const androidNative =
      typeof window !== 'undefined' ? (window as any).AndroidNative : null;
    if (androidNative && typeof androidNative.saveBase64File === 'function') {
      const base64Data: string = XLSX.write(wb, {
        bookType: 'xlsx',
        type: 'base64',
      });
      androidNative.saveBase64File(base64Data, nombreArchivo, mimeType);
      return;
    }

    const excelBuffer: ArrayBuffer = XLSX.write(wb, {
      bookType: 'xlsx',
      type: 'array',
    });
    const blob = new Blob([excelBuffer], { type: mimeType });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', nombreArchivo);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
