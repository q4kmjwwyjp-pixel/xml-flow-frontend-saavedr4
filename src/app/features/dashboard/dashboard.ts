import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FacturaService } from '../../core/services/factura.service';
import { FacturaResumen, MetricasDashboard } from '../../core/models/factura.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {

  private readonly router = inject(Router);

  cargando = signal(true);
  metricas: MetricasDashboard | null = null;
  todasLasFacturas: FacturaResumen[] = [];
  facturasRecientes: FacturaResumen[] = []; // Reemplaza a facturasFiltradas

  // Modales
  facturaSeleccionada: FacturaResumen | null = null;

  constructor(private facturaService: FacturaService) { }

  ngOnInit(): void {
    this.cargarDatos();
  }

  goUploadPage() {
    this.router.navigateByUrl('/upload');
  }

  cargarDatos(): void {
    this.cargando.set(true);

    this.facturaService.getFacturas().subscribe({
      next: (data) => {
        try {
          this.todasLasFacturas = data || [];
          this.filtrarUltimas24Horas();
          this.calcularMetricas(this.facturasRecientes);
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

  filtrarUltimas24Horas(): void {
    const hace24Horas = new Date();
    hace24Horas.setHours(hace24Horas.getHours() - 24);

    this.facturasRecientes = this.todasLasFacturas.filter((factura) => {
      // NOTA: Usa 'createdAt' si Prisma lo genera, o 'fechaRevision' según venga mapeado de tu backend
      const fechaEscaneo = new Date((factura as any).createdAt || factura.fechaRevision || new Date());
      return fechaEscaneo >= hace24Horas;
    });
  }

  calcularMetricas(facturas: FacturaResumen[]): void {
    const hoy = new Date().toISOString().split('T')[0];
    
    // Ahora filtramos basándonos en el nuevo estado "Pendiente"
    const pendientes = facturas.filter(f => f.estado === 'pendiente');

    const pagosHoy = pendientes.filter(f => f.fechaProgramacionPago && f.fechaProgramacionPago.startsWith(hoy)).length;
    const montoTotal = pendientes.reduce((sum, current) => sum + current.total, 0);

    this.metricas = {
      totalRevisadas: facturas.length,
      totalProgramadas: pendientes.length, // Reutilizamos tu propiedad del modelo para no romper tu interface
      pagosProgramadosHoy: pagosHoy,
      montoProgramadoPago: montoTotal
    };
  }

  verDetalleXml(factura: FacturaResumen): void {
    this.facturaSeleccionada = factura;
  }

  cerrarDetalle(): void {
    this.facturaSeleccionada = null;
  }

  esPagoHoy(fecha: string): boolean {
    if(!fecha) return false;
    const hoy = new Date().toISOString().split('T')[0];
    return fecha.startsWith(hoy);
  }
}