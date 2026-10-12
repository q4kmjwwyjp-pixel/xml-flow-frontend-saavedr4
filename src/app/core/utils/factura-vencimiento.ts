import { FacturaResumen } from '../models/factura.model';

export interface InfoVencimiento {
  /** true si la factura es a crédito, está aprobada y ya pasó su fecha límite de pago. */
  vencida: boolean;
  /** Días transcurridos desde la fecha límite (solo > 0 si está vencida). */
  diasVencida: number;
  /** Días que faltan para la fecha límite (0 = vence hoy; solo aplica si no está vencida). */
  diasRestantes: number;
}

const MS_DIA = 24 * 60 * 60 * 1000;

/** Convierte 'YYYY-MM-DD' a una fecha local a las 00:00 (evita el desfase de zona horaria de new Date('YYYY-MM-DD')). */
function aFechaLocal(iso?: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

/**
 * Una factura está VENCIDA cuando es a crédito (PPD), no fue rechazada
 * y su fecha límite de pago (fechaProgramacionPago) ya quedó atrás.
 */
export function calcularVencimiento(
  f: Pick<FacturaResumen, 'metodoPago' | 'estado' | 'fechaProgramacionPago'>,
  hoy: Date = new Date(),
): InfoVencimiento {
  const limite = aFechaLocal(f.fechaProgramacionPago);
  if (f.metodoPago !== 'PPD' || f.estado === 'RECHAZADA' || !limite) {
    return { vencida: false, diasVencida: 0, diasRestantes: 0 };
  }
  const hoy0 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const diff = Math.round((hoy0.getTime() - limite.getTime()) / MS_DIA);
  return diff > 0
    ? { vencida: true, diasVencida: diff, diasRestantes: 0 }
    : { vencida: false, diasVencida: 0, diasRestantes: Math.max(0, -diff) };
}
