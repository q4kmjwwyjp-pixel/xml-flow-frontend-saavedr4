import { obtenerDatosCatalogoPorRfc } from './catalogo-proveedores';

/** De dónde salió el plazo de crédito de una factura */
export type OrigenDiasCredito = 'xml' | 'lista' | 'ninguno';

export interface ResultadoDiasCredito {
  /** Días de crédito finales (0 cuando no hay plazo aplicable) */
  dias: number;
  /** 1° XML -> 2° Lista de Proveedores ("Cond. Pag./Prov.") -> 3° ninguno */
  origen: OrigenDiasCredito;
  /** true si la factura es a crédito (PPD o el XML indica días/condición de crédito) */
  esCredito: boolean;
}

export interface DatosDiasCredito {
  condicionesPago?: string | null;
  metodoPago?: string | null;
  rfc?: string | null;
  /**
   * Días ya calculados por el backend. Solo se usan como respaldo cuando el
   * catálogo local (copia del Excel) no tiene registrado el RFC del proveedor.
   */
  diasCredito?: number | null;
}

/**
 * Extrae los días de crédito del atributo del XML:
 * <cfdi:Comprobante CondicionesDePago="30 días fecha factura">
 */
export function diasCreditoDesdeXml(
  condicionesPago?: string | null
): number | null {
  const cond = (condicionesPago || '').trim();
  if (!cond) return null;

  const match = cond.match(/\b(\d+)\s*d[ií]as?\b/i);
  if (!match) return null;

  const dias = parseInt(match[1], 10);
  return Number.isNaN(dias) || dias < 0 ? null : dias;
}

/**
 * Días de crédito registrados en la Lista de Proveedores
 * (columna "Cond. Pag./Prov." del catálogo oficial en Excel).
 */
export function diasCreditoEnListaProveedores(
  rfc?: string | null,
  diasRespaldo?: number | null
): number | null {
  const delCatalogo = obtenerDatosCatalogoPorRfc(rfc);
  if (
    delCatalogo?.diasCredito !== undefined &&
    delCatalogo?.diasCredito !== null
  ) {
    return Number(delCatalogo.diasCredito);
  }

  if (
    diasRespaldo !== undefined &&
    diasRespaldo !== null &&
    Number(diasRespaldo) > 0
  ) {
    return Number(diasRespaldo);
  }

  return null;
}

/** Regla única de días de crédito: 1° XML -> 2° Lista de Proveedores -> 3° 0 días */
export function calcularDiasCredito(
  datos: DatosDiasCredito
): ResultadoDiasCredito {
  const diasEnXml = diasCreditoDesdeXml(datos.condicionesPago);
  const condiciones = (datos.condicionesPago || '').toLowerCase();

  const esCredito =
    (datos.metodoPago || '').trim().toUpperCase() === 'PPD' ||
    (diasEnXml !== null && diasEnXml > 0) ||
    condiciones.includes('crédito') ||
    condiciones.includes('credito');

  if (diasEnXml !== null) {
    return { dias: diasEnXml, origen: 'xml', esCredito };
  }

  const diasEnLista = diasCreditoEnListaProveedores(
    datos.rfc,
    datos.diasCredito
  );
  if (esCredito && diasEnLista !== null) {
    return { dias: diasEnLista, origen: 'lista', esCredito };
  }

  return { dias: 0, origen: 'ninguno', esCredito };
}
