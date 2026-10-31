/** Catálogos SAT (CFDI 4.0) oficiales */

export interface RegimenFiscalItem {
  clave: string;
  descripcion: string;
}

export const CATALOGO_REGIMENES_FISCALES: RegimenFiscalItem[] = [
  { clave: '601', descripcion: 'General de Ley Personas Morales' },
  { clave: '603', descripcion: 'Personas Morales con Fines no Lucrativos' },
  {
    clave: '605',
    descripcion: 'Sueldos y Salarios e Ingresos Asimilados a Salarios',
  },
  { clave: '606', descripcion: 'Arrendamiento' },
  {
    clave: '607',
    descripcion: 'Régimen de Enajenación o Adquisición de Bienes',
  },
  { clave: '608', descripcion: 'Demás ingresos' },
  {
    clave: '610',
    descripcion:
      'Residentes en el Extranjero sin Establecimiento Permanente en México',
  },
  {
    clave: '611',
    descripcion: 'Ingresos por Dividendos (socios y accionistas)',
  },
  {
    clave: '612',
    descripcion:
      'Personas Físicas con Actividades Empresariales y Profesionales',
  },
  { clave: '614', descripcion: 'Ingresos por intereses' },
  {
    clave: '615',
    descripcion: 'Régimen de los ingresos por obtención de premios',
  },
  { clave: '616', descripcion: 'Sin obligaciones fiscales' },
  {
    clave: '620',
    descripcion:
      'Sociedades Cooperativas de Producción que optan por diferir sus ingresos',
  },
  { clave: '621', descripcion: 'Incorporación Fiscal' },
  {
    clave: '622',
    descripcion: 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras',
  },
  { clave: '623', descripcion: 'Opcional para Grupos de Sociedades' },
  { clave: '624', descripcion: 'Coordinados' },
  {
    clave: '625',
    descripcion:
      'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas',
  },
  {
    clave: '626',
    descripcion: 'Régimen Simplificado de Confianza (RESICO)',
  },
];

export const REGIMENES_FISCALES: Record<string, string> = Object.fromEntries(
  CATALOGO_REGIMENES_FISCALES.map((item) => [item.clave, item.descripcion])
);

/**
 * Normaliza de forma resiliente cualquier valor de régimen fiscal guardado
 * (ej. "601", "601 (General de Ley...)", "601 - General...", o solo la descripción)
 * devolviendo la clave numérica de 3 dígitos ("601") o '' si no coincide.
 */
export function normalizarClaveRegimenFiscal(valor?: string | null): string {
  if (!valor) return '';
  const limpio = valor.trim();
  if (!limpio) return '';

  // 1. Coincidencia directa por clave exacta
  if (REGIMENES_FISCALES[limpio]) {
    return limpio;
  }

  // 2. Extraer código de 3 dígitos al inicio (ej. "601 (General...)" o "601 - General...")
  const matchCodigo = limpio.match(/^(\d{3})\b/);
  if (matchCodigo && REGIMENES_FISCALES[matchCodigo[1]]) {
    return matchCodigo[1];
  }

  // 3. Buscar coincidencia por descripción (insensible a mayúsculas/acentos)
  const normalizar = (str: string) =>
    str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const buscadoNorm = normalizar(limpio);
  const encontrado = CATALOGO_REGIMENES_FISCALES.find(
    (item) =>
      normalizar(item.descripcion) === buscadoNorm ||
      buscadoNorm.includes(normalizar(item.descripcion))
  );

  return encontrado ? encontrado.clave : '';
}

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

/** Devuelve "CLAVE - Descripción" (o solo la clave si no está en el catálogo, o "—" si no hay dato). */
export function describirClave(
  catalogo: Record<string, string>,
  clave?: string | null
): string {
  if (!clave) return '—';
  return catalogo[clave] ? `${clave} - ${catalogo[clave]}` : clave;
}
