import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import * as XLSXStyle from 'xlsx-js-style';
import {
  ProveedorService,
  Proveedor,
} from '../../core/services/proveedor.service';
import { AuthService } from '../../core/services/auth.service';
import {
  CATALOGO_REGIMENES_FISCALES,
  REGIMENES_FISCALES,
  RegimenFiscalItem,
  normalizarClaveRegimenFiscal,
} from '../../core/utils/catalogos-sat';

@Component({
  selector: 'app-proveedores',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './proveedores.component.html',
})
export class Proveedores implements OnInit {
  public proveedorService = inject(ProveedorService);
  public authService = inject(AuthService);
  private router = inject(Router);

  readonly regimenesFiscales: RegimenFiscalItem[] = CATALOGO_REGIMENES_FISCALES;

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
    diasCredito: null as number | null,
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

  formatearRegimen(valor?: string): string {
    const clave =
      normalizarClaveRegimenFiscal(valor) || (valor || '').trim() || '601';
    const descripcion = REGIMENES_FISCALES[clave];
    return descripcion ? `${clave} (${descripcion})` : clave;
  }

  esPersonaFisica(): boolean {
    const rfcLimpio = (this.proveedorForm.rfc || '').trim().toUpperCase();
    const reg = normalizarClaveRegimenFiscal(this.proveedorForm.regimenFiscal);
    const regimenesFisica = new Set([
      '605',
      '606',
      '607',
      '608',
      '611',
      '612',
      '614',
      '615',
      '616',
      '621',
      '625',
    ]);
    return rfcLimpio.length === 13 || regimenesFisica.has(reg);
  }

  onRfcInputChange(valor: string): void {
    this.proveedorForm.rfc = valor;
    if (this.mensajeError()) {
      this.mensajeError.set(null);
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
      diasCredito: null,
    };
    this.mostrarModal.set(true);
  }

  abrirModalEditar(prov: Proveedor): void {
    this.modoEdicion.set(true);
    this.mensajeError.set(null);
    const claveNormalizada =
      normalizarClaveRegimenFiscal(prov.regimenFiscal) ||
      (prov.rfc?.trim().length === 12 ? '601' : '612');

    this.proveedorForm = {
      codigoProveedor:
        prov.codigoProveedor && prov.codigoProveedor !== 'S/N'
          ? prov.codigoProveedor
          : '',
      rfc: prov.rfc,
      nombre: prov.nombre,
      regimenFiscal: claveNormalizada,
      diasCredito:
        prov.diasCredito !== undefined && prov.diasCredito !== null
          ? Number(prov.diasCredito)
          : 0,
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
      diasCredito: null,
    };
  }

  confirmarEliminacion(prov: Proveedor): void {
    if (!this.authService.esAdmin()) return;
    this.proveedorAEliminar.set(prov);
    this.mostrarModalEliminar.set(true);
  }

  cerrarModalEliminar(): void {
    this.mostrarModalEliminar.set(false);
    this.proveedorAEliminar.set(null);
  }

  ejecutarEliminacion(): void {
    if (!this.authService.esAdmin()) return;
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

  /**
   * Valida que el nombre/razón social cumpla con el formato "Apellidos Nombre"
   * (mínimo 2 palabras para Apellidos y Nombre, normalizado en mayúsculas).
   */
  validarFormatoApellidosNombre(nombre: string, rfc: string): string | null {
    const palabras = nombre.split(' ').filter((p) => p.length > 0);
    if (palabras.length < 2) {
      return 'Debes ingresar el nombre bajo el formato "Apellidos Nombre" (mínimo un apellido y un nombre, ej. GARZA CARLOS MARIA DE JESUS).';
    }
    if (rfc.length === 13 && palabras.length < 2) {
      return 'Para Persona Física el formato obligatorio es "Apellidos Nombre" (ej. QUIROGA MIRELES ALBERTO).';
    }
    return null;
  }

  guardarProveedor(): void {
    this.mensajeError.set(null);

    const codigoLimpio = (this.proveedorForm.codigoProveedor || '')
      .trim()
      .replace(/^#+/, '')
      .trim();
    const rfcLimpio = this.proveedorForm.rfc.trim().toUpperCase();
    const nombreLimpio = this.proveedorForm.nombre
      .replace(/,/g, ' ')
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase();
    const regimenLimpio = normalizarClaveRegimenFiscal(
      this.proveedorForm.regimenFiscal
    );

    if (!rfcLimpio || !nombreLimpio || !regimenLimpio) {
      this.mensajeError.set(
        'Por favor completa los campos obligatorios (RFC, Apellidos Nombre / Razón Social y Régimen Fiscal).'
      );
      return;
    }

    if (!this.validarRFC(rfcLimpio)) {
      this.mensajeError.set('El formato del RFC no es válido.');
      return;
    }

    const errorFormatoNombre = this.validarFormatoApellidosNombre(
      nombreLimpio,
      rfcLimpio
    );
    if (errorFormatoNombre) {
      this.mensajeError.set(errorFormatoNombre);
      return;
    }

    const errorDuplicado = this.proveedorService.validarDuplicados(
      {
        codigoProveedor: codigoLimpio,
        rfc: rfcLimpio,
        nombre: nombreLimpio,
      },
      this.modoEdicion()
    );

    if (errorDuplicado) {
      this.mensajeError.set(errorDuplicado);
      return;
    }

    if (this.modoEdicion()) {
      const diasCreditoNum =
        this.proveedorForm.diasCredito !== null &&
        this.proveedorForm.diasCredito !== undefined &&
        !Number.isNaN(Number(this.proveedorForm.diasCredito))
          ? Math.max(0, parseInt(String(this.proveedorForm.diasCredito), 10))
          : 0;

      this.proveedorService
        .actualizarProveedor(rfcLimpio, {
          codigoProveedor: codigoLimpio,
          nombre: nombreLimpio,
          regimenFiscal: regimenLimpio,
          diasCredito: diasCreditoNum,
        })
        .subscribe({
          next: () => {
            this.cerrarModal();
            this.mostrarMensajeTemporal('Proveedor actualizado correctamente.');
          },
          error: (err) => {
            console.error('Error al actualizar proveedor:', err);
            const msg =
              err?.error?.message ||
              err?.message ||
              'Error al actualizar la información del proveedor.';
            this.mensajeError.set(
              Array.isArray(msg) ? msg.join(' ') : String(msg)
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
            const msg =
              err?.error?.message ||
              err?.message ||
              'Error al registrar el proveedor. Verifica si el Código, RFC o Razón Social ya están ocupados.';
            this.mensajeError.set(
              Array.isArray(msg) ? msg.join(' ') : String(msg)
            );
          },
        });
    }
  }

  alternarVistaPruebas(): void {
    this.authService.toggleMostrarDatosPrueba();
    this.paginaActual.set(1);
  }

  totalProveedoresVisibles(): number {
    return this.proveedorService
      .proveedores()
      .filter((p) => this.authService.debeMostrarProveedor(p)).length;
  }

  proveedoresFiltrados(): Proveedor[] {
    const busqueda = this.filtroBusqueda().trim().toLowerCase();
    const lista = this.proveedorService
      .proveedores()
      .filter((p) => this.authService.debeMostrarProveedor(p));
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
    }, 5500);
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
        if (!Array.isArray(row) || row.length < 3) continue;
        const clave = String(row[0] ?? '')
          .trim()
          .replace(/^#+/, '')
          .trim();
        const rfc = String(row[1] ?? '')
          .trim()
          .toUpperCase()
          .replace(/[\s-]/g, '');
        const nombre = String(row[3] || row[2] || '')
          .trim()
          .replace(/\s+/g, ' ')
          .toUpperCase();

        if (!clave || clave.toLowerCase() === 'clave') continue;
        if (
          !nombre ||
          nombre.toLowerCase().includes('razon social') ||
          nombre.toLowerCase().includes('razón social')
        )
          continue;
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
          next: (res) => {
            this.importandoArchivo.set(false);
            if (res.nuevos > 0 && res.omitidos > 0) {
              this.mostrarMensajeTemporal(
                `Se agregaron ${res.nuevos.toLocaleString('es-MX')} nuevos proveedores. Se omitieron ${res.omitidos.toLocaleString('es-MX')} que ya estaban registrados para evitar duplicados.`
              );
            } else if (res.nuevos > 0) {
              this.mostrarMensajeTemporal(
                `Se agregaron ${res.nuevos.toLocaleString('es-MX')} nuevos proveedores correctamente.`
              );
            } else {
              this.mostrarMensajeTemporal(
                `No se generaron duplicados: los ${res.omitidos.toLocaleString('es-MX')} proveedores del archivo Excel ya estaban dados de alta.`
              );
            }
          },
          error: () => {
            this.importandoArchivo.set(false);
          },
        });
      } else {
        this.importandoArchivo.set(false);
        this.mostrarMensajeTemporal(
          `El catálogo de proveedores (${this.proveedorService.proveedores().length.toLocaleString('es-MX')} registros) ya está activo y sin duplicados.`
        );
      }
    } catch {
      this.importandoArchivo.set(false);
    } finally {
      input.value = '';
    }
  }
}
