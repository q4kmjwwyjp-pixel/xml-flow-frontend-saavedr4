export interface ProveedorInfo {
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

/**
 * Forma esperada del JSON que devuelve el endpoint de validación de NestJS
 * (Persona 2), alineada campo por campo con el modelo `FacturaXML` de
 * `prisma/schema.prisma` (revisado en el repo de backend del equipo) para
 * que la integración real sea directa:
 *
 *   model FacturaXML {
 *     uuid, serie?, folio?, fechaEmision, subTotal, total, metodoPago,
 *     formaPago?, usoCfdi, regimenReceptor, condicionesPago?, diasCredito,
 *     estadoValidacion, motivoRechazo?, proveedor -> Proveedor { rfc, nombre, regimenFiscal }
 *   }
 *
 * `erroresDetalle` es una EXTENSIÓN SUGERIDA: hoy el esquema solo guarda un
 * `motivoRechazo` (string único), pero la Interfaz 3 pide un "diagnóstico
 * fiscal detallado". Se deja la estructura lista por si Backend decide
 * desglosar los errores por campo (RFC, régimen, uso de CFDI, etc.). Si no
 * se implementa, la Alerta de rechazo cae de forma automática a mostrar
 * solo `motivoRechazo`.
 */
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
  estadoValidacion: 'Aprobada' | 'Rechazada' | 'Pendiente' | string;
  motivoRechazo?: string | null;
  proveedor: ProveedorInfo;
  /** Viene de PagoProgramado.fechaEstimadaPago cuando la factura fue aprobada */
  fechaEstimadaPago?: string | null;
  /** Extensión sugerida — ver comentario arriba */
  erroresDetalle?: DiagnosticoFiscal[];
}

export function esFacturaAprobada(resultado: CfdiValidationResult): boolean {
  return (resultado.estadoValidacion ?? '').trim().toLowerCase() === 'aprobada';
}
