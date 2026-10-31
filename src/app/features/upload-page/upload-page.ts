import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CfdiValidationService } from '../../core/services/cfdi-validation.service';
import { CfdiValidationResult } from '../../core/models/cfdi-validation.model';
import { LogoXmlFlowComponent } from '../../shared/components/logo-xml-flow/logo-xml-flow.component';
import {
  obtenerDatosCatalogoPorRfc,
  resolverCodigoProveedor,
} from '../../core/utils/catalogo-proveedores';
import { API_URL } from '../../core/config/api.config';

@Component({
  selector: 'app-upload-page',
  standalone: true,
  imports: [CommonModule, LogoXmlFlowComponent],
  templateUrl: './upload-page.html',
})
export class UploadPage {
  private readonly http = inject(HttpClient);
  private readonly cfdiService = inject(CfdiValidationService);
  private readonly router = inject(Router);

  regresar() {
    this.router.navigateByUrl('/dashboard');
  }

  archivoSeleccionado = signal<File | null>(null);
  estaArrastrando = signal<boolean>(false);
  cargando = signal<boolean>(false);
  mensajeError = signal<string | null>(null);

  private readonly apiUrl = `${API_URL}/xml/upload`;

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

  private extraerDatosXmlLocal(xml: string) {
    const getAttr = (tagPattern: string, attr: string): string => {
      const tagMatch = xml.match(new RegExp(`<${tagPattern}[^>]*>`, 'i'));
      if (!tagMatch) return '';
      const attrMatch = tagMatch[0].match(
        new RegExp(`${attr}\\s*=\\s*["']([^"']*)["']`, 'i')
      );
      return attrMatch ? attrMatch[1].trim() : '';
    };

    const rfc = getAttr('cfdi:Emisor', 'Rfc').toUpperCase();
    const delCatalogo = obtenerDatosCatalogoPorRfc(rfc);
    const nombre =
      getAttr('cfdi:Emisor', 'Nombre') ||
      delCatalogo?.nombre ||
      'Desconocido';
    const regimenFiscal =
      getAttr('cfdi:Emisor', 'RegimenFiscal') ||
      delCatalogo?.regimenFiscal ||
      '';

    return {
      uuid: getAttr('tfd:TimbreFiscalDigital', 'UUID') || 'N/A',
      serie: getAttr('cfdi:Comprobante', 'Serie'),
      folio: getAttr('cfdi:Comprobante', 'Folio'),
      fechaEmision: getAttr('cfdi:Comprobante', 'Fecha'),
      subTotal: Number(getAttr('cfdi:Comprobante', 'SubTotal') || 0),
      total: Number(getAttr('cfdi:Comprobante', 'Total') || 0),
      metodoPago: getAttr('cfdi:Comprobante', 'MetodoPago'),
      formaPago: getAttr('cfdi:Comprobante', 'FormaPago'),
      condicionesPago: getAttr('cfdi:Comprobante', 'CondicionesDePago'),
      usoCfdi: getAttr('cfdi:Receptor', 'UsoCFDI'),
      regimenReceptor: getAttr('cfdi:Receptor', 'RegimenFiscalReceptor'),
      rfc: rfc || 'N/A',
      nombre,
      regimenFiscal,
      codigoProveedor: resolverCodigoProveedor(rfc, null),
    };
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
      const infoLocal = this.extraerDatosXmlLocal(xmlContenido);

      const headers = new HttpHeaders({
        'Content-Type': 'application/xml',
      });

      interface BackendResponse {
        message: string;
        factura: CfdiValidationResult;
      }

      this.http
        .post<BackendResponse>(this.apiUrl, xmlContenido, { headers })
        .subscribe({
          next: (response) => {
            this.cargando.set(false);
            const datosFactura = response.factura;
            const rfcProv =
              datosFactura.proveedor?.rfc || infoLocal.rfc || 'N/A';
            const delCatalogo = obtenerDatosCatalogoPorRfc(rfcProv);

            datosFactura.proveedor = {
              ...datosFactura.proveedor,
              rfc: rfcProv,
              nombre:
                datosFactura.proveedor?.nombre ||
                delCatalogo?.nombre ||
                infoLocal.nombre,
              regimenFiscal:
                datosFactura.proveedor?.regimenFiscal ||
                delCatalogo?.regimenFiscal ||
                infoLocal.regimenFiscal,
              codigoProveedor: resolverCodigoProveedor(
                rfcProv,
                datosFactura.proveedor?.codigoProveedor
              ),
            };

            this.cfdiService.resultadoActual.set(datosFactura);

            if (
              datosFactura.estadoValidacion === 'Validada' ||
              datosFactura.estadoValidacion === 'Aprobada'
            ) {
              this.router.navigateByUrl('/validacion-exitosa');
            } else {
              this.router.navigateByUrl('/alerta-rechazo');
            }
          },
          error: (err) => {
            this.cargando.set(false);

            const mensajeBackend =
              typeof err?.error === 'string'
                ? err.error
                : err?.error?.message || err?.error?.error;

            this.cfdiService.resultadoActual.set({
              uuid: infoLocal.uuid,
              serie: infoLocal.serie,
              folio: infoLocal.folio,
              fechaEmision: infoLocal.fechaEmision,
              subTotal: infoLocal.subTotal,
              total: infoLocal.total,
              metodoPago: infoLocal.metodoPago,
              formaPago: infoLocal.formaPago,
              usoCfdi: infoLocal.usoCfdi,
              regimenReceptor: infoLocal.regimenReceptor,
              condicionesPago: infoLocal.condicionesPago,
              diasCredito: 0,
              estadoValidacion: 'Rechazada',
              motivoRechazo:
                mensajeBackend ||
                'Error de conexión: No se pudo contactar al servidor.',
              proveedor: {
                codigoProveedor: infoLocal.codigoProveedor,
                rfc: infoLocal.rfc,
                nombre: infoLocal.nombre,
                regimenFiscal: infoLocal.regimenFiscal,
              },
              erroresDetalle: [],
            });

            this.router.navigateByUrl('/alerta-rechazo');
          },
        });
    } catch (e) {
      this.cargando.set(false);
      this.mensajeError.set(
        'No se pudo leer el contenido del archivo seleccionado.'
      );
    }
  }
}
