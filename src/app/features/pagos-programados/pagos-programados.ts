import { Component, OnInit, inject, signal, computed, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FacturaService } from '../../core/services/factura.service';

@Component({
  imports: [RouterLink, CommonModule, FormsModule],
  selector: 'app-pagos-programados',
  styleUrl: './pagos-programados.css',
  templateUrl: './pagos-programados.html',
})
export class PagosProgramados implements OnInit {
  private facturaService = inject(FacturaService);
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);

  cargando = signal<boolean>(true);
  errorCarga = signal<string | null>(null);
  origenNavegacion = signal<'reportes' | 'dashboard'>('dashboard');

  textoBotonRegresar = computed(() =>
    this.origenNavegacion() === 'reportes'
      ? '← Regresar a Generador de Reportes'
      : '← Regresar al Dashboard'
  );

  todasLasFacturas: any[] = [];
  facturasFiltradas: any[] = [];
  facturaSeleccionada: any = null;

  // Propiedades para los Filtros
  busquedaTexto: string = '';
  fechaFiltroProgramacion: string = '';
  filtroCondicion: string = 'TODAS';
  ordenSeleccionado: string = 'asc';

  ngOnInit() {
    this.route.queryParamMap.subscribe((params) => {
      const stateActual = (this.location.getState() as Record<string, any>) || {};
      const origenParam = params.get('origen') || stateActual['origen'];
      this.origenNavegacion.set(origenParam === 'reportes' ? 'reportes' : 'dashboard');
    });

    this.cargarFacturas();
  }

  cargarFacturas(): void {
    this.cargando.set(true);
    this.errorCarga.set(null);

    this.facturaService.getFacturas().subscribe({
      next: (facturas) => {
        this.todasLasFacturas = facturas || [];
        // Aplicamos los filtros y el orden desde el inicio
        this.aplicarFiltros();
        this.cargando.set(false);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al conectar con Render:', err);
        this.errorCarga.set('No se pudieron obtener los comprobantes programados. Verifica tu conexión.');
        this.cargando.set(false);
        this.cdr.detectChanges();
      },
    });
  }

  regresar(): void {
    if (this.origenNavegacion() === 'reportes') {
      this.router.navigateByUrl('/reportes-semanales');
      return;
    }
    this.router.navigateByUrl('/dashboard');
  }

  // Función que restaura la lógica de filtros
  aplicarFiltros() {
    this.facturasFiltradas = this.todasLasFacturas.filter((f) => {
      const coincideFecha = !this.fechaFiltroProgramacion || f.fechaProgramacionPago === this.fechaFiltroProgramacion;
      
      const busqueda = (this.busquedaTexto || '').toLowerCase();
      const coincideTexto = !busqueda ||
        (f.codigoProveedor || '').toLowerCase().includes(busqueda) ||
        (f.rfcEmisor || '').toLowerCase().includes(busqueda) ||
        (f.nombreProveedor || '').toLowerCase().includes(busqueda) ||
        (f.folio || '').toString().toLowerCase().includes(busqueda);
      
      const coincideCondicion = this.filtroCondicion === 'TODAS' || f.metodoPago === this.filtroCondicion;

      return coincideFecha && coincideTexto && coincideCondicion;
    });

    // Mantenemos el orden elegido por el usuario después de filtrar
    this.ordenarLista(this.ordenSeleccionado);
  }

  cambiarOrden(event: any) {
    this.ordenSeleccionado = event.target.value;
    this.ordenarLista(this.ordenSeleccionado);
  }

  private ordenarLista(orden: string) {
    this.facturasFiltradas.sort((a, b) => {
      const fechaA = a.fechaProgramacionPago ? new Date(a.fechaProgramacionPago).getTime() : 0;
      const fechaB = b.fechaProgramacionPago ? new Date(b.fechaProgramacionPago).getTime() : 0;
      return orden === 'asc' ? fechaA - fechaB : fechaB - fechaA;
    });
  }

  esPagoHoy(fecha: string): boolean {
    if(!fecha) return false;
    const hoy = new Date().toISOString().split('T')[0];
    return fecha.startsWith(hoy);
  }

  verDetalleXml(factura: any) {
    this.facturaSeleccionada = factura;
  }

  cerrarDetalle() {
    this.facturaSeleccionada = null;
  }
}
