/** Catálogos SAT (CFDI 4.0) más comunes, solo para mostrar descripciones legibles. */

export const METODOS_PAGO: Record<string, string> = {
  PUE: 'Pago en una sola exhibición',
  PPD: 'Pago en parcialidades o diferido',
};

export const FORMAS_PAGO: Record<string, string> = {
  '01': 'Efectivo',
  '02': 'Cheque nominativo',
  '03': 'Transferencia electrónica de fondos',
  '04': 'Tarjeta de crédito',
  '28': 'Tarjeta de débito',
  '99': 'Por definir',
};

export const USOS_CFDI: Record<string, string> = {
  G01: 'Adquisición de mercancías',
  G02: 'Devoluciones, descuentos o bonificaciones',
  G03: 'Gastos en general',
  I04: 'Equipo de cómputo y accesorios',
  P01: 'Por definir',
  S01: 'Sin efectos fiscales',
};

export const REGIMENES_FISCALES: Record<string, string> = {
  '601': 'General de Ley Personas Morales',
  '603': 'Personas Morales con Fines no Lucrativos',
  '605': 'Sueldos y Salarios',
  '606': 'Arrendamiento',
  '612': 'Personas Físicas con Actividades Empresariales y Profesionales',
  '616': 'Sin obligaciones fiscales',
  '621': 'Incorporación Fiscal',
  '624': 'Coordinados',
  '626': 'Régimen Simplificado de Confianza',
};

/** Devuelve "CLAVE - Descripción" (o solo la clave si no está en el catálogo, o "—" si no hay dato). */
export function describirClave(catalogo: Record<string, string>, clave?: string | null): string {
  if (!clave) return '—';
  return catalogo[clave] ? `${clave} - ${catalogo[clave]}` : clave;
}
