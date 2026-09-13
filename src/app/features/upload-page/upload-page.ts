import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
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

      this.http.post<CfdiValidationResult>(this.apiUrl, xmlContenido, { headers }).subscribe({
        next: (json) => {
          this.cargando.set(false);
          this.cfdiService.procesarRespuesta(json);
        },
        error: (err) => {
          this.cargando.set(false);
          this.mensajeError.set(
            err?.error?.message || 'Error al conectar con el servidor o procesar el archivo.'
          );
        }
      });
    } catch (e) {
      this.cargando.set(false);
      this.mensajeError.set('No se pudo leer el contenido del archivo seleccionado.');
    }
  }
}