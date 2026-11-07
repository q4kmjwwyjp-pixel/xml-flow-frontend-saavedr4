import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CfdiValidationService } from '../../core/services/cfdi-validation.service';
import {
  CfdiValidationResult,
  DiagnosticoFiscal,
} from '../../core/models/cfdi-validation.model';
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

  private static readonly RFC_RECEPTOR_OFICIAL = 'TSH731116TL4';
  private static readonly RAZON_SOCIAL_OFICIAL =
    'TRANSPORTES DE LOS SANTOS E HIJOS';
  private static readonly REGIMEN_RECEPTOR_OFICIAL = '624';
  private static readonly USO_CFDI_OFICIAL = 'G03';

  private extraerDatosXmlLocal(xml: string) {
    const getAttr = (tagPattern: string, attr: string): string => {
      const tagMatch = xml.match(new RegExp(`<${tagPattern}[^>]*>`, 'i'));
      if (!tagMatch) return '';
      const attrMatch = tagMatch[0].match(
        new RegExp(`\\b${attr}\\s*=\\s*["']([^"']*)["']`, 'i')
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
      metodoPago: getAttr('cfdi:Comprobante', 'MetodoPago').toUpperCase(),
      formaPago: getAttr('cfdi:Comprobante', 'FormaPago'),
      condicionesPago: getAttr('cfdi:Comprobante', 'CondicionesDePago'),
      rfcReceptor: getAttr('cfdi:Receptor', 'Rfc').toUpperCase(),
      nombreReceptor: getAttr('cfdi:Receptor', 'Nombre')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase(),
      usoCfdi: getAttr('cfdi:Receptor', 'UsoCFDI').toUpperCase(),
      regimenReceptor: getAttr('cfdi:Receptor', 'RegimenFiscalReceptor'),
      rfc: rfc || 'N/A',
      nombre,
      regimenFiscal,
      codigoProveedor: resolverCodigoProveedor(rfc, null),
    };
  }

  private validarCamposFiscales(
    info: ReturnType<UploadPage['extraerDatosXmlLocal']>
  ): DiagnosticoFiscal[] {
    const errores: DiagnosticoFiscal[] = [];

    if (info.rfcReceptor !== UploadPage.RFC_RECEPTOR_OFICIAL) {
      errores.push({
        campo: 'RFC Receptor',
        descripcion:
          'El RFC receptor no coincide con el RFC oficial de nuestra empresa.',
        valorEncontrado: info.rfcReceptor || 'Vacío',
        valorEsperado: UploadPage.RFC_RECEPTOR_OFICIAL,
      });
    }

    if (info.nombreReceptor !== UploadPage.RAZON_SOCIAL_OFICIAL) {
      errores.push({
        campo: 'Razón Social Receptor',
        descripcion:
          'La razón social del receptor no coincide exactamente con nuestra empresa.',
        valorEncontrado: info.nombreReceptor || 'Vacío',
        valorEsperado: UploadPage.RAZON_SOCIAL_OFICIAL,
      });
    }

    if (info.regimenReceptor !== UploadPage.REGIMEN_RECEPTOR_OFICIAL) {
      errores.push({
        campo: 'Régimen Fiscal Receptor',
        descripcion:
          'El régimen fiscal del receptor no corresponde al autorizado (624 - Coordinados).',
        valorEncontrado: info.regimenReceptor || 'Vacío',
        valorEsperado: UploadPage.REGIMEN_RECEPTOR_OFICIAL,
      });
    }

    if (info.usoCfdi !== UploadPage.USO_CFDI_OFICIAL) {
      errores.push({
        campo: 'Uso de CFDI',
        descripcion:
          'El uso de CFDI no corresponde a Gastos en general (G03).',
        valorEncontrado: info.usoCfdi || 'Vacío',
        valorEsperado: UploadPage.USO_CFDI_OFICIAL,
      });
    }

    if (info.metodoPago !== 'PPD' && info.metodoPago !== 'PUE') {
      errores.push({
        campo: 'Método de Pago',
        descripcion: 'El método de pago debe ser PPD o PUE.',
        valorEncontrado: info.metodoPago || 'Vacío',
        valorEsperado: 'PPD o PUE',
      });
    }

    if (info.formaPago !== '99' && info.formaPago !== '03') {
      errores.push({
        campo: 'Forma de Pago',
        descripcion:
          'La forma de pago debe ser 99 (Por definir) o 03 (Transferencia electrónica).',
        valorEncontrado: info.formaPago || 'Vacío',
        valorEsperado: '99 o 03',
      });
    }

    return errores;
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
      const erroresFiscales = this.validarCamposFiscales(infoLocal);

      if (erroresFiscales.length > 0) {
        this.cargando.set(false);
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
          motivoRechazo: erroresFiscales.map((e) => e.descripcion).join(' '),
          proveedor: {
            codigoProveedor: infoLocal.codigoProveedor,
            rfc: infoLocal.rfc,
            nombre: infoLocal.nombre,
            regimenFiscal: infoLocal.regimenFiscal,
          },
          erroresDetalle: erroresFiscales,
        });
        this.router.navigateByUrl('/alerta-rechazo');
        return;
      }

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
