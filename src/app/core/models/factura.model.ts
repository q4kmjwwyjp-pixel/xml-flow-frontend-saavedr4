// 1. Estados posibles de la factura (El semáforo)
export type EstadoFactura = 
  | 'PROGRAMADA'
  | 'PROGRAMADA A PAGO'
  | 'CON OBSERVACIONES'
  | 'RECHAZADA';

// 2. Revisiones fiscales detalladas
export interface ChecksFiscales {
  rfcValido?: boolean;
  rfcReceptorValido?: boolean;
  razonSocialValida?: boolean;      // <-- Requerido por tu HTML
  regimenValido?: boolean;
  usoCfdiValido?: boolean;
  metodoTransferencia?: boolean;
  metodoPagoValido?: boolean;
  formaPagoValida?: boolean;
  proveedorEnBD?: boolean;
}

// 3. Estructura exacta de la Factura
export interface FacturaResumen {
  id?: number | string;
  folio: string;
  codigoProveedor: string;
  codigo?: string;
  nombreProveedor: string;
  proveedor?: string;
  rfcEmisor: string;
  condicion?: string;               // <-- Con '?' porque la rechazada no lo trae
  credito?: string;
  creditoDias?: number;
  diasCredito?: number;
  fechaRevision?: string;
  fechaProgramacionPago: string;
  metodoPago: string;               // <-- Sin '?' para que el HTML no marque 'possibly undefined'
  formaPago?: string;
  total: number;
  estado: EstadoFactura;
  motivoRechazo?: string;
  observaciones?: string;
  checksFiscales: ChecksFiscales;
}

// Alias para usar cualquiera de los dos nombres
export type Factura = FacturaResumen;

// 4. Métricas de las 4 tarjetas superiores del Dashboard
export interface MetricasDashboard {
  totalRevisadas: number;
  totalProgramadas: number;         // <-- Requerido por tu dashboard
  totalRechazadas: number;          // <-- Requerido por tu dashboard
  pagosProgramadosHoy: number;      // <-- Requerido por tu dashboard
  montoProgramadoPago: number;      // <-- Requerido por tu dashboard
  totalFacturas?: number;
  programadasPago?: number;
  conObservaciones?: number;
  rechazadas?: number;
  montoTotalProgramado?: number;
}