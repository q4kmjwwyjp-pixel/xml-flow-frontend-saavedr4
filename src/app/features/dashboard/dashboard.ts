import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FacturaService } from '../../core/services/factura.service';
import { FacturaResumen, MetricasDashboard } from '../../core/models/factura.model';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  metricas: MetricasDashboard | null = null;
  todasLasFacturas: FacturaResumen[] = [];
  facturasFiltradas: FacturaResumen[] = [];

  // Filtros
  fechaFiltroProgramacion: string = '';
  busquedaTexto: string = '';
  filtroEstado: string = 'TODAS';

  // Modales
  facturaSeleccionada: FacturaResumen | null = null;
  mostrarReporteSemanal: boolean = false;

  constructor(private facturaService: FacturaService) {}

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.facturaService.getMetricas().subscribe({
      next: (data) => (this.metricas = data),
      error: (err) => console.error('Error al cargar métricas:', err),
    });

    this.facturaService.getFacturas().subscribe({
      next: (data) => {
        this.todasLasFacturas = data;
        this.aplicarFiltros();
      },
      error: (err) => console.error('Error al cargar facturas:', err),
    });
  }

  aplicarFiltros(): void {
    this.facturasFiltradas = this.todasLasFacturas.filter((factura) => {
      // 1. Filtro de calendario por fecha programada de pago
      const coincideFecha =
        !this.fechaFiltroProgramacion ||
        factura.fechaProgramacionPago === this.fechaFiltroProgramacion;

      // 2. Filtro de búsqueda por Código, RFC, Proveedor o Folio
      const busqueda = this.busquedaTexto.toLowerCase();
      const coincideTexto =
        !this.busquedaTexto ||
        factura.codigoProveedor.toLowerCase().includes(busqueda) ||
        factura.rfcEmisor.toLowerCase().includes(busqueda) ||
        factura.nombreProveedor.toLowerCase().includes(busqueda) ||
        factura.folio.toLowerCase().includes(busqueda);

      // 3. Filtro por estado (PROGRAMADA o RECHAZADA)
      const coincideEstado =
        this.filtroEstado === 'TODAS' || factura.estado === this.filtroEstado;

      return coincideFecha && coincideTexto && coincideEstado;
    });
  }

  limpiarFiltroFecha(): void {
    this.fechaFiltroProgramacion = '';
    this.aplicarFiltros();
  }

  // Detalle de XML
  verDetalleXml(factura: FacturaResumen): void {
    this.facturaSeleccionada = factura;
  }

  cerrarDetalle(): void {
    this.facturaSeleccionada = null;
  }

  // Reporte Semanal de Pagos
  abrirReporteSemanal(): void {
    this.mostrarReporteSemanal = true;
  }

  cerrarReporteSemanal(): void {
    this.mostrarReporteSemanal = false;
  }

  get facturasParaReporte(): FacturaResumen[] {
    return this.todasLasFacturas.filter((f) => f.estado === 'PROGRAMADA');
  }

  imprimirReporte(): void {
    window.print();
  }

  esPagoHoy(fecha: string): boolean {
    const hoy = '2026-09-12';
    return fecha === hoy;
  }
}
