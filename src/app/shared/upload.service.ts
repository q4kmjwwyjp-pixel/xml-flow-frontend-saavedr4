import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface ResultadoValidacion {
  uuid?: string;
  serie?: string;
  folio?: string;
  proveedor: {
    nombre: string;
    rfc: string;
  };
  regimenReceptor: string;
  usoCfdi: string;
  metodoPago: string;
  formaPago?: string;
  total: number;
  condicionesPago?: string;
  diasCredito?: number;
  fechaEstimadaPago?: string;
  fechaEmision: string;
}

@Injectable({
  providedIn: 'root'
})
export class UploadService {
  private readonly apiUrl = 'http://localhost:3000/api/xml/upload';

  public resultadoValidacion = signal<ResultadoValidacion | null>(null);

  constructor(private http: HttpClient) {}

  uploadXml(file: File): Observable<ResultadoValidacion> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<ResultadoValidacion>(this.apiUrl, formData).pipe(
      tap((res) => {
        this.resultadoValidacion.set(res);
      })
    );
  }
}