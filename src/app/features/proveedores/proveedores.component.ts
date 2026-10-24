import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProveedorService, Proveedor } from '../../core/services/proveedor.service';

@Component({
  selector: 'app-proveedores',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './proveedores.component.html'
})
export class Proveedores implements OnInit {
  public proveedorService = inject(ProveedorService);
  private router = inject(Router);

  mostrarModal = signal<boolean>(false);
  mostrarModalEliminar = signal<boolean>(false);
  modoEdicion = signal<boolean>(false);
  mensajeError = signal<string | null>(null);

  // Proveedor seleccionado para eliminar
  proveedorAEliminar = signal<Proveedor | null>(null);

  proveedorForm = {
    rfc: '',
    nombre: '',
    regimenFiscal: ''
  };

  filtroBusqueda = signal<string>('');

  ngOnInit(): void {
    this.proveedorService.obtenerProveedores().subscribe();
  }

  regresar(): void {
    this.router.navigateByUrl('/dashboard');
  }

  abrirModalNuevo(): void {
    this.modoEdicion.set(false);
    this.mensajeError.set(null);
    this.proveedorForm = { rfc: '', nombre: '', regimenFiscal: '' };
    this.mostrarModal.set(true);
  }

  abrirModalEditar(prov: Proveedor): void {
    this.modoEdicion.set(true);
    this.mensajeError.set(null);
    this.proveedorForm = {
      rfc: prov.rfc,
      nombre: prov.nombre,
      regimenFiscal: prov.regimenFiscal || ''
    };
    this.mostrarModal.set(true);
  }

  cerrarModal(): void {
    this.mostrarModal.set(false);
    this.mensajeError.set(null);
    this.proveedorForm = { rfc: '', nombre: '', regimenFiscal: '' };
  }

  confirmarEliminacion(prov: Proveedor): void {
    this.proveedorAEliminar.set(prov);
    this.mostrarModalEliminar.set(true);
  }

  cerrarModalEliminar(): void {
    this.mostrarModalEliminar.set(false);
    this.proveedorAEliminar.set(null);
  }

  ejecutarEliminacion(): void {
    const prov = this.proveedorAEliminar();
    if (!prov) return;

    this.proveedorService.eliminarProveedor(prov.rfc).subscribe({
      next: () => {
        this.cerrarModalEliminar();
      },
      error: (err) => {
        console.error('Error al eliminar proveedor:', err);
      }
    });
  }

  validarRFC(rfc: string): boolean {
    const rfcClean = rfc.trim().toUpperCase();
    const rfcRegex = /^([A-ZÑ&]{3,4})([0-9]{2})(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])([A-Z0-9]{3})$/;
    return rfcRegex.test(rfcClean);
  }

  guardarProveedor(): void {
    this.mensajeError.set(null);

    const rfcLimpio = this.proveedorForm.rfc.trim().toUpperCase();
    const nombreLimpio = this.proveedorForm.nombre.trim();

    if (!rfcLimpio || !nombreLimpio) {
      this.mensajeError.set('Por favor completa los campos obligatorios (RFC y Razón Social).');
      return;
    }

    if (!this.validarRFC(rfcLimpio)) {
      this.mensajeError.set('El formato del RFC no es válido.');
      return;
    }

    if (this.modoEdicion()) {
      this.proveedorService.actualizarProveedor(rfcLimpio, {
        nombre: nombreLimpio,
        regimenFiscal: this.proveedorForm.regimenFiscal.trim()
      }).subscribe({
        next: () => this.cerrarModal(),
        error: (err) => {
          console.error('Error al actualizar proveedor:', err);
          this.mensajeError.set('Error al actualizar la información del proveedor.');
        }
      });
    } else {
      this.proveedorService.crearProveedor({
        rfc: rfcLimpio,
        nombre: nombreLimpio,
        regimenFiscal: this.proveedorForm.regimenFiscal.trim()
      }).subscribe({
        next: () => this.cerrarModal(),
        error: (err) => {
          console.error('Error al crear proveedor:', err);
          this.mensajeError.set('Error al registrar el proveedor. Verifica si el RFC ya existe.');
        }
      });
    }
  }

  proveedoresFiltrados(): Proveedor[] {
    const busqueda = this.filtroBusqueda().toLowerCase();
    return this.proveedorService.proveedores().filter(p =>
      p.nombre.toLowerCase().includes(busqueda) ||
      p.rfc.toLowerCase().includes(busqueda)
    );
  }
}