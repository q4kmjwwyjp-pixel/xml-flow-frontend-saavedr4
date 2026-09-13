import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FacturaService } from '../../core/services/factura.service';
import { FacturaResumen, MetricasDashboard } from '../../core/models/factura.model';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule,],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {

  private readonly router = inject(Router)

  cargando = signal(true);
  metricas: MetricasDashboard | null = null;
  todasLasFacturas: FacturaResumen[] = [];
  facturasFiltradas: FacturaResumen[] = [];

  // Filtros
  fechaFiltroProgramacion: string = '';
  busquedaTexto: string = '';
  filtroCondicion: string = 'TODAS';

  // Modales
  facturaSeleccionada: FacturaResumen | null = null;

  constructor(private facturaService: FacturaService) {}

  ngOnInit(): void {
    this.cargarDatos();
  }

  goUploadPage() {
    this.router.navigateByUrl('/upload')
  }

  cargarDatos(): void {
    this.cargando.set(true);
    
    this.facturaService.getFacturas().subscribe({
      next: (data) => {
        try {
          this.todasLasFacturas = data || []; 
          this.aplicarFiltros();
          this.calcularMetricas(this.todasLasFacturas);
          this.cargando.set(false); 
        } catch (error) {
          console.error('Error procesando datos:', error);
          this.cargando.set(false);
        }
      },
      error: (err) => {
        console.error('Error al cargar facturas:', err);
        this.cargando.set(false);
      },
    });
  }

  calcularMetricas(facturas: FacturaResumen[]): void {
    const hoy = new Date().toISOString().split('T')[0];
    const programadas = facturas.filter(f => f.estado === 'PROGRAMADA');
    
    const pagosHoy = programadas.filter(f => f.fechaProgramacionPago === hoy).length;
    const montoTotal = programadas.reduce((sum, current) => sum + current.total, 0);

    this.metricas = {
      totalRevisadas: facturas.length,
      totalProgramadas: programadas.length,
      pagosProgramadosHoy: pagosHoy,
      montoProgramadoPago: montoTotal
    };
  }

  aplicarFiltros(): void {
    this.facturasFiltradas = this.todasLasFacturas.filter((factura) => {
      const coincideFecha = !this.fechaFiltroProgramacion || factura.fechaProgramacionPago === this.fechaFiltroProgramacion;
      
      const busqueda = (this.busquedaTexto || '').toLowerCase();
      const coincideTexto = !busqueda ||
        (factura.codigoProveedor || '').toLowerCase().includes(busqueda) ||
        (factura.rfcEmisor || '').toLowerCase().includes(busqueda) ||
        (factura.nombreProveedor || '').toLowerCase().includes(busqueda) ||
        (factura.folio || '').toString().toLowerCase().includes(busqueda);
        
      const coincideCondicion = this.filtroCondicion === 'TODAS' || factura.metodoPago === this.filtroCondicion;

      return coincideFecha && coincideTexto && coincideCondicion;
    });
  }

  limpiarFiltroFecha(): void {
    this.fechaFiltroProgramacion = '';
    this.aplicarFiltros();
  }

  verDetalleXml(factura: FacturaResumen): void {
    this.facturaSeleccionada = factura;
  }

  cerrarDetalle(): void {
    this.facturaSeleccionada = null;
  }

  esPagoHoy(fecha: string): boolean {
    const hoy = new Date().toISOString().split('T')[0]; 
    return fecha === hoy;
  }
}