export interface ChecksFiscales {
  rfcValido?: boolean;
  rfcReceptorValido?: boolean;
  razonSocialValida?: boolean;
  regimenValido?: boolean;
  usoCfdiValido?: boolean;
  metodoTransferencia?: boolean;
  metodoPagoValido?: boolean;
  formaPagoValida?: boolean;
  proveedorEnBD?: boolean;
}

export interface FacturaResumen {
  id?: number | string;
  estado: 'pendiente' | 'pagado' | 'vencido';
  folio: string;
  folioContrarrecibo?: string;
  moneda?: string;
  codigoProveedor: string;
  codigo?: string;
  nombreProveedor: string;
  proveedor?: string;
  rfcEmisor: string;
  condicion?: string;
  credito?: string;
  creditoDias?: number;
  diasCredito?: number;
  fechaRevision?: string;
  fechaProgramacionPago: string;
  metodoPago: string;
  formaPago?: string;
  total: number;
  motivoRechazo?: string;
  observaciones?: string;
  checksFiscales: ChecksFiscales;

  // --- Campos extra para la pantalla de detalle (opcionales) ---
  uuid?: string;
  fechaEmision?: string;
  subTotal?: number;
  usoCfdi?: string;
  regimenReceptor?: string;
  regimenEmisor?: string;
  condicionesPago?: string;
}

// Alias para usar cualquiera de los dos nombres
export type Factura = FacturaResumen;

// 4. Métricas de las 4 tarjetas superiores del Dashboard
export interface MetricasDashboard {
  totalRevisadas: number;
  totalProgramadas: number;
  pagosProgramadosHoy: number;
  montoProgramadoPago: number;
}
