import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FacturaService } from '../../core/services/factura.service';
import { calcularVencimiento } from '../../core/utils/factura-vencimiento';

@Component({
  imports: [RouterLink],
  selector: 'app-pagos-programados',
  styleUrl: './pagos-programados.css',
  templateUrl: './pagos-programados.html',
})
export class PagosProgramados implements OnInit {
  private facturaService = inject(FacturaService);
  private cdr = inject(ChangeDetectorRef);

  facturasFiltradas: any[] = [];

  facturaSeleccionada: any = null;

  ngOnInit() {
    this.facturaService.getFacturas().subscribe({
      next: (facturas) => {
        this.facturasFiltradas = facturas;

        this.ordenarLista('asc');

        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al conectar con Render:', err);
      }
    });
  }

  cambiarOrden(event: any) {
    const orden = event.target.value;
    this.ordenarLista(orden);
  }

  private ordenarLista(orden: string) {
    this.facturasFiltradas.sort((a, b) => {
      const fechaA = a.fechaProgramacionPago ? new Date(a.fechaProgramacionPago).getTime() : 0;
      const fechaB = b.fechaProgramacionPago ? new Date(b.fechaProgramacionPago).getTime() : 0;
      return orden === 'asc' ? fechaA - fechaB : fechaB - fechaA;
    });
  }

  /** true si la factura es a crédito y ya pasó su fecha límite de pago. */
  esVencida(factura: any): boolean {
    return calcularVencimiento(factura).vencida;
  }

  verDetalleXml(factura: any) {
    this.facturaSeleccionada = factura;
  }

  cerrarDetalle() {
    this.facturaSeleccionada = null;
  }
}