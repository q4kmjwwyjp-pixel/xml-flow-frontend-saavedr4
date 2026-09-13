import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CfdiValidationService } from '../../core/services/cfdi-validation.service';
import { CfdiValidationResult } from '../../core/models/cfdi-validation.model';
import { LogoXmlFlowComponent } from '../../shared/components/logo-xml-flow/logo-xml-flow.component';

@Component({
  selector: 'app-upload-page',
  standalone: true,
  imports: [CommonModule, LogoXmlFlowComponent],
  templateUrl: './upload-page.html',
})
export class UploadPage {
  private readonly http = inject(HttpClient);
  private readonly cfdiService = inject(CfdiValidationService);
  private readonly router = inject(Router)

  archivoSeleccionado = signal<File | null>(null);
  estaArrastrando = signal<boolean>(false);
  cargando = signal<boolean>(false);
  mensajeError = signal<string | null>(null);

  private readonly apiUrl = 'http://localhost:3000/xml/upload';

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.estaArrastrando.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.estaArrastrando.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.estaArrastrando.set(false);

    if (event.dataTransfer?.files.length) {
      this.validarYAsignarArchivo(event.dataTransfer.files[0]);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.validarYAsignarArchivo(input.files[0]);
    }
  }

  validarYAsignarArchivo(file: File): void {
    this.mensajeError.set(null);
    if (!file.name.toLowerCase().endsWith('.xml')) {
      this.mensajeError.set('Por favor selecciona un archivo con formato .xml.');
      this.archivoSeleccionado.set(null);
      return;
    }
    this.archivoSeleccionado.set(file);
  }

  limpiarArchivo(): void {
    this.archivoSeleccionado.set(null);
    this.mensajeError.set(null);
  }

  async enviarArchivo(): Promise<void> {
    const file = this.archivoSeleccionado();
    if (!file) {
      this.mensajeError.set('Por favor selecciona un archivo XML.');
      return;
    }

    this.cargando.set(true);
    this.mensajeError.set(null);

    try {
      const xmlContenido = await file.text();

      const headers = new HttpHeaders({
        'Content-Type': 'application/xml',
      });

      // Definimos la estructura de lo que responde tu backend
      interface BackendResponse {
        message: string;
        factura: CfdiValidationResult;
      }

      this.http.post<BackendResponse>(this.apiUrl, xmlContenido, { headers }).subscribe({
        next: (response) => {
          this.cargando.set(false);
          console.log(response.factura);
          const datosFactura = response.factura;
          this.cfdiService.resultadoActual.set(datosFactura);

          if (datosFactura.estadoValidacion === 'Validada' || datosFactura.estadoValidacion === 'Aprobada') {
            this.router.navigateByUrl('/validacion-exitosa');
          } else {
            this.router.navigateByUrl('/alerta-rechazo');
          }
        },
        error: (err) => {
          this.cargando.set(false);

          // Extraemos el mensaje que envía tu backend (puede venir directo en err.error si es texto, o en err.error.message si es un objeto JSON)
          const mensajeBackend = typeof err?.error === 'string' 
            ? err.error 
            : (err?.error?.message || err?.error?.error);

          // Creamos una estructura de rechazo simulada para la pantalla de alerta
          this.cfdiService.resultadoActual.set({
            uuid: 'N/A',
            serie: '',
            folio: '',
            fechaEmision: '',
            subTotal: 0,
            total: 0,
            metodoPago: '',
            formaPago: '',
            usoCfdi: '',
            regimenReceptor: '',
            condicionesPago: '',
            diasCredito: 0,
            estadoValidacion: 'Rechazada',
            // Si el backend mandó mensaje lo usamos; si no (ej. caída de red), usamos un error genérico del navegador
            motivoRechazo: mensajeBackend || 'Error de conexión: No se pudo contactar al servidor.',
            proveedor: {
              rfc: 'N/A',
              nombre: 'Desconocido',
              regimenFiscal: '',
            },
            erroresDetalle: [],
          });

          // Redirigimos a la pantalla de alerta de rechazo
          this.router.navigateByUrl('/alerta-rechazo');
        }
      });
    } catch (e) {
      this.cargando.set(false);
      this.mensajeError.set('No se pudo leer el contenido del archivo seleccionado.');
    }
  }
}