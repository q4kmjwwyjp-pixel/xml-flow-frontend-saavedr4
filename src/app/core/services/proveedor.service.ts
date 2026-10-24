import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface Proveedor {
  rfc: string;
  nombre: string;
  regimenFiscal: string;
  codigoProveedor?: string;
  activo?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ProveedorService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'https://xml-flow-back-end.onrender.com/proveedor';

  public proveedores = signal<Proveedor[]>([]);
  public cargando = signal<boolean>(false);

  obtenerProveedores(): Observable<Proveedor[]> {
    this.cargando.set(true);
    return this.http.get<Proveedor[]>(this.apiUrl).pipe(
      tap((data) => {
        this.proveedores.set(data);
        this.cargando.set(false);
      })
    );
  }

  crearProveedor(nuevoProveedor: { rfc: string; nombre: string; regimenFiscal: string }): Observable<Proveedor> {
    return this.http.post<Proveedor>(this.apiUrl, nuevoProveedor).pipe(
      tap(() => this.obtenerProveedores().subscribe())
    );
  }

  actualizarProveedor(rfc: string, datosActualizados: { nombre?: string; regimenFiscal?: string }): Observable<Proveedor> {
    return this.http.patch<Proveedor>(`${this.apiUrl}/${rfc}`, datosActualizados).pipe(
      tap(() => this.obtenerProveedores().subscribe())
    );
  }

  eliminarProveedor(rfc: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${rfc}`).pipe(
      tap(() => this.obtenerProveedores().subscribe())
    );
  }
}