import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import * as XLSXStyle from 'xlsx-js-style';
import {
  ProveedorService,
  Proveedor,
} from '../../core/services/proveedor.service';
import { obtenerDatosCatalogoPorRfc } from '../../core/utils/catalogo-proveedores';

@Component({
  selector: 'app-proveedores',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './proveedores.component.html',
})
export class Proveedores implements OnInit {
  public proveedorService = inject(ProveedorService);
  private router = inject(Router);

  mostrarModal = signal<boolean>(false);
  mostrarModalEliminar = signal<boolean>(false);
  modoEdicion = signal<boolean>(false);
  mensajeError = signal<string | null>(null);
  mensajeExito = signal<string | null>(null);
  importandoArchivo = signal<boolean>(false);

  proveedorAEliminar = signal<Proveedor | null>(null);

  proveedorForm = {
    codigoProveedor: '',
    rfc: '',
    nombre: '',
    regimenFiscal: '',
  };

  filtroBusqueda = signal<string>('');
  paginaActual = signal<number>(1);
  readonly tamanoPagina = 50;

  ngOnInit(): void {
    this.proveedorService.obtenerProveedores().subscribe();
  }

  regresar(): void {
    this.router.navigateByUrl('/dashboard');
  }

  actualizarBusqueda(valor: string): void {
    this.filtroBusqueda.set(valor);
    this.paginaActual.set(1);
  }

  onRfcInputChange(valor: string): void {
    this.proveedorForm.rfc = valor;
    if (!this.modoEdicion()) {
      const encontrado = obtenerDatosCatalogoPorRfc(valor);
      if (encontrado) {
        if (!this.proveedorForm.codigoProveedor) {
          this.proveedorForm.codigoProveedor = encontrado.codigoProveedor;
        }
        if (!this.proveedorForm.nombre) {
          this.proveedorForm.nombre = encontrado.nombre;
        }
        if (!this.proveedorForm.regimenFiscal) {
          this.proveedorForm.regimenFiscal = encontrado.regimenFiscal;
        }
      }
    }
  }

  abrirModalNuevo(): void {
    this.modoEdicion.set(false);
    this.mensajeError.set(null);
    this.proveedorForm = {
      codigoProveedor: '',
      rfc: '',
      nombre: '',
      regimenFiscal: '',
    };
    this.mostrarModal.set(true);
  }

  abrirModalEditar(prov: Proveedor): void {
    this.modoEdicion.set(true);
    this.mensajeError.set(null);
    this.proveedorForm = {
      codigoProveedor:
        prov.codigoProveedor && prov.codigoProveedor !== 'S/N'
          ? prov.codigoProveedor
          : '',
      rfc: prov.rfc,
      nombre: prov.nombre,
      regimenFiscal: prov.regimenFiscal || '',
    };
    this.mostrarModal.set(true);
  }

  cerrarModal(): void {
    this.mostrarModal.set(false);
    this.mensajeError.set(null);
    this.proveedorForm = {
      codigoProveedor: '',
      rfc: '',
      nombre: '',
      regimenFiscal: '',
    };
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
      },
    });
  }

  validarRFC(rfc: string): boolean {
    const rfcClean = rfc.trim().toUpperCase();
    const rfcRegex =
      /^([A-ZÑ&]{3,4})([0-9]{2})(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])([A-Z0-9]{3})$/;
    return (
      rfcRegex.test(rfcClean) ||
      rfcClean.length === 12 ||
      rfcClean.length === 13
    );
  }

  guardarProveedor(): void {
    this.mensajeError.set(null);

    const codigoLimpio = (this.proveedorForm.codigoProveedor || '').trim();
    const rfcLimpio = this.proveedorForm.rfc.trim().toUpperCase();
    const nombreLimpio = this.proveedorForm.nombre.trim();
    const regimenLimpio =
      this.proveedorForm.regimenFiscal.trim() ||
      (rfcLimpio.length === 12 ? '601' : '612');

    if (!rfcLimpio || !nombreLimpio) {
      this.mensajeError.set(
        'Por favor completa los campos obligatorios (RFC y Razón Social).'
      );
      return;
    }

    if (!this.validarRFC(rfcLimpio)) {
      this.mensajeError.set('El formato del RFC no es válido.');
      return;
    }

    if (this.modoEdicion()) {
      this.proveedorService
        .actualizarProveedor(rfcLimpio, {
          codigoProveedor: codigoLimpio,
          nombre: nombreLimpio,
          regimenFiscal: regimenLimpio,
        })
        .subscribe({
          next: () => {
            this.cerrarModal();
            this.mostrarMensajeTemporal('Proveedor actualizado correctamente.');
          },
          error: (err) => {
            console.error('Error al actualizar proveedor:', err);
            this.mensajeError.set(
              'Error al actualizar la información del proveedor.'
            );
          },
        });
    } else {
      this.proveedorService
        .crearProveedor({
          codigoProveedor: codigoLimpio,
          rfc: rfcLimpio,
          nombre: nombreLimpio,
          regimenFiscal: regimenLimpio,
        })
        .subscribe({
          next: () => {
            this.cerrarModal();
            this.mostrarMensajeTemporal('Proveedor registrado correctamente.');
          },
          error: (err) => {
            console.error('Error al crear proveedor:', err);
            this.mensajeError.set(
              'Error al registrar el proveedor. Verifica si el RFC ya existe.'
            );
          },
        });
    }
  }

  proveedoresFiltrados(): Proveedor[] {
    const busqueda = this.filtroBusqueda().trim().toLowerCase();
    const lista = this.proveedorService.proveedores();
    if (!busqueda) return lista;

    return lista.filter(
      (p) =>
        (p.codigoProveedor || '').toLowerCase().includes(busqueda) ||
        p.nombre.toLowerCase().includes(busqueda) ||
        p.rfc.toLowerCase().includes(busqueda)
    );
  }

  totalPaginas(): number {
    const total = this.proveedoresFiltrados().length;
    return Math.max(1, Math.ceil(total / this.tamanoPagina));
  }

  proveedoresPaginados(): Proveedor[] {
    const filtrados = this.proveedoresFiltrados();
    const pag = Math.min(this.paginaActual(), this.totalPaginas());
    const inicio = (pag - 1) * this.tamanoPagina;
    return filtrados.slice(inicio, inicio + this.tamanoPagina);
  }

  rangoInicio(): number {
    const total = this.proveedoresFiltrados().length;
    if (total === 0) return 0;
    return (this.paginaActual() - 1) * this.tamanoPagina + 1;
  }

  rangoFin(): number {
    const total = this.proveedoresFiltrados().length;
    return Math.min(total, this.paginaActual() * this.tamanoPagina);
  }

  paginaAnterior(): void {
    if (this.paginaActual() > 1) {
      this.paginaActual.set(this.paginaActual() - 1);
    }
  }

  paginaSiguiente(): void {
    if (this.paginaActual() < this.totalPaginas()) {
      this.paginaActual.set(this.paginaActual() + 1);
    }
  }

  private mostrarMensajeTemporal(msg: string): void {
    this.mensajeExito.set(msg);
    setTimeout(() => {
      if (this.mensajeExito() === msg) {
        this.mensajeExito.set(null);
      }
    }, 4500);
  }

  async onArchivoExcelSeleccionado(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.importandoArchivo.set(true);
    this.mensajeError.set(null);
    this.mensajeExito.set(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSXStyle.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows = XLSXStyle.utils.sheet_to_json<any[]>(worksheet, {
        header: 1,
        defval: '',
      });

      const importados: Array<{
        codigoProveedor: string;
        rfc: string;
        nombre: string;
        regimenFiscal: string;
      }> = [];

      for (const row of rows) {
        if (!Array.isArray(row) || row.length < 4) continue;
        const clave = String(row[0] ?? '').trim();
        const rfc = String(row[1] ?? '')
          .trim()
          .toUpperCase()
          .replace(/[\s-]/g, '');
        const nombre = String(row[3] ?? '').trim();

        if (!clave || clave.toLowerCase() === 'clave') continue;
        if (rfc.length !== 12 && rfc.length !== 13) continue;
        if (
          rfc.startsWith('XEXX') ||
          rfc.startsWith('XXXX') ||
          rfc.startsWith('XAXX')
        )
          continue;

        importados.push({
          codigoProveedor: clave,
          rfc,
          nombre,
          regimenFiscal: rfc.length === 12 ? '601' : '612',
        });
      }

      if (importados.length > 0) {
        this.proveedorService.importarProveedoresLote(importados).subscribe({
          next: () => {
            this.importandoArchivo.set(false);
            this.mostrarMensajeTemporal(
              `Se sincronizaron ${importados.length.toLocaleString('es-MX')} proveedores desde el archivo con su Número de Proveedor (Clave).`
            );
          },
          error: () => {
            this.importandoArchivo.set(false);
          },
        });
      } else {
        this.importandoArchivo.set(false);
        this.mostrarMensajeTemporal(
          `El catálogo de proveedores (${this.proveedorService.proveedores().length.toLocaleString('es-MX')} registros) ya está activo y vinculado.`
        );
      }
    } catch {
      this.importandoArchivo.set(false);
    } finally {
      input.value = '';
    }
  }
}
