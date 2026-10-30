export interface ProveedorInfo {
  codigoProveedor?: string | null;
  rfc: string;
  nombre: string;
  regimenFiscal: string;
}

export interface DiagnosticoFiscal {
  campo: string;
  descripcion: string;
  valorEncontrado?: string;
  valorEsperado?: string;
}

export interface CfdiValidationResult {
  id?: number;
  uuid: string;
  serie?: string | null;
  folio?: string | null;
  fechaEmision: string;
  subTotal: number;
  total: number;
  metodoPago: string;
  formaPago?: string | null;
  usoCfdi: string;
  regimenReceptor: string;
  condicionesPago?: string | null;
  diasCredito: number;
  estadoValidacion: 'Validada' | 'Aprobada' | 'Rechazada' | 'Pendiente' | string;
  motivoRechazo?: string | null;
  proveedor: ProveedorInfo;
  fechaEstimadaPago?: string | null;
  erroresDetalle?: DiagnosticoFiscal[];
}

export function esFacturaAprobada(json: CfdiValidationResult): boolean {
  return json.estadoValidacion === 'Aprobada' || json.estadoValidacion === 'Validada';
}
