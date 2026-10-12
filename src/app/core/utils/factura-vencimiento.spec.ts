import { calcularVencimiento } from './factura-vencimiento';

describe('calcularVencimiento', () => {
  const hoy = new Date(2026, 9, 11, 23, 30); // 11-oct-2026

  it('marca vencida una factura a crédito con fecha límite pasada', () => {
    const r = calcularVencimiento({ metodoPago: 'PPD', estado: 'PROGRAMADA', fechaProgramacionPago: '2026-10-08' }, hoy);
    expect(r).toEqual({ vencida: true, diasVencida: 3, diasRestantes: 0 });
  });

  it('no está vencida el mismo día de la fecha límite', () => {
    const r = calcularVencimiento({ metodoPago: 'PPD', estado: 'PROGRAMADA', fechaProgramacionPago: '2026-10-11' }, hoy);
    expect(r.vencida).toBe(false);
    expect(r.diasRestantes).toBe(0);
  });

  it('calcula los días restantes si aún está en plazo', () => {
    const r = calcularVencimiento({ metodoPago: 'PPD', estado: 'PROGRAMADA', fechaProgramacionPago: '2026-10-20' }, hoy);
    expect(r).toEqual({ vencida: false, diasVencida: 0, diasRestantes: 9 });
  });

  it('ignora contado (PUE) y rechazadas', () => {
    expect(calcularVencimiento({ metodoPago: 'PUE', estado: 'PAGADA', fechaProgramacionPago: '2026-01-01' }, hoy).vencida).toBe(false);
    expect(calcularVencimiento({ metodoPago: 'PPD', estado: 'RECHAZADA', fechaProgramacionPago: '2026-01-01' }, hoy).vencida).toBe(false);
  });

  it('tolera fecha vacía', () => {
    expect(calcularVencimiento({ metodoPago: 'PPD', estado: 'PROGRAMADA', fechaProgramacionPago: '' }, hoy).vencida).toBe(false);
  });
});
