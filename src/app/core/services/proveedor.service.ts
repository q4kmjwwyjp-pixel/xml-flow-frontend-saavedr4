import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap, catchError, map } from 'rxjs';
import {
  CATALOGO_PROVEEDORES,
  obtenerDatosCatalogoPorRfc,
  resolverCodigoProveedor,
} from '../utils/catalogo-proveedores';

export interface Proveedor {
  id?: number;
  codigoProveedor?: string;
  rfc: string;
  nombre: string;
  regimenFiscal: string;
  activo?: boolean;
}

const STORAGE_OVERRIDES_KEY = 'xmlflow_proveedores_overrides_v1';
const STORAGE_DELETED_KEY = 'xmlflow_proveedores_deleted_v1';

@Injectable({
  providedIn: 'root',
})
export class ProveedorService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'https://xml-flow-back-end.onrender.com/proveedor';

  public proveedores = signal<Proveedor[]>([]);
  public cargando = signal<boolean>(false);

  private leerOverridesLocales(): Record<string, Proveedor> {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    try {
      const raw = window.localStorage.getItem(STORAGE_OVERRIDES_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private guardarOverrideLocal(prov: Proveedor): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const actual = this.leerOverridesLocales();
      actual[prov.rfc.toUpperCase()] = prov;
      window.localStorage.setItem(STORAGE_OVERRIDES_KEY, JSON.stringify(actual));
    } catch {
      // ignore storage errors
    }
  }

  private leerEliminadosLocales(): Set<string> {
    if (typeof window === 'undefined' || !window.localStorage) return new Set();
    try {
      const raw = window.localStorage.getItem(STORAGE_DELETED_KEY);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  }

  private marcarEliminadoLocal(rfc: string): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const set = this.leerEliminadosLocales();
      set.add(rfc.toUpperCase());
      window.localStorage.setItem(
        STORAGE_DELETED_KEY,
        JSON.stringify(Array.from(set))
      );
      const overrides = this.leerOverridesLocales();
      delete overrides[rfc.toUpperCase()];
      window.localStorage.setItem(
        STORAGE_OVERRIDES_KEY,
        JSON.stringify(overrides)
      );
    } catch {
      // ignore
    }
  }

  private desmarcarEliminadoLocal(rfc: string): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const set = this.leerEliminadosLocales();
      if (set.has(rfc.toUpperCase())) {
        set.delete(rfc.toUpperCase());
        window.localStorage.setItem(
          STORAGE_DELETED_KEY,
          JSON.stringify(Array.from(set))
        );
      }
    } catch {
      // ignore
    }
  }

  private fusionarConCatalogo(remotos: Proveedor[]): Proveedor[] {
    const eliminados = this.leerEliminadosLocales();
    const overrides = this.leerOverridesLocales();
    const mapa = new Map<string, Proveedor>();

    // 1. Cargar todos los proveedores del Excel oficial (Clave + RFC + Nombre + Régimen)
    for (const item of CATALOGO_PROVEEDORES) {
      const rfcKey = item.rfc.toUpperCase();
      if (eliminados.has(rfcKey)) continue;
      mapa.set(rfcKey, {
        codigoProveedor: item.codigoProveedor,
        rfc: item.rfc,
        nombre: item.nombre,
        regimenFiscal: item.regimenFiscal,
      });
    }

    // 2. Fusionar con los proveedores devueltos por el backend
    for (const p of remotos || []) {
      if (!p?.rfc) continue;
      const rfcKey = p.rfc.toUpperCase();
      if (eliminados.has(rfcKey)) continue;
      const previo = mapa.get(rfcKey);
      mapa.set(rfcKey, {
        ...previo,
        ...p,
        rfc: rfcKey,
        codigoProveedor: resolverCodigoProveedor(
          rfcKey,
          p.codigoProveedor || previo?.codigoProveedor
        ),
        nombre: p.nombre || previo?.nombre || 'Proveedor Sin Nombre',
        regimenFiscal:
          p.regimenFiscal ||
          previo?.regimenFiscal ||
          (rfcKey.length === 12 ? '601' : '612'),
      });
    }

    // 3. Aplicar overrides locales (ediciones de clave/nombre recientes)
    for (const [rfcKey, ov] of Object.entries(overrides)) {
      if (eliminados.has(rfcKey)) continue;
      const previo = mapa.get(rfcKey);
      mapa.set(rfcKey, {
        ...previo,
        ...ov,
        codigoProveedor: resolverCodigoProveedor(
          rfcKey,
          ov.codigoProveedor || previo?.codigoProveedor
        ),
      });
    }

    return Array.from(mapa.values()).sort((a, b) => {
      const numA = Number(a.codigoProveedor);
      const numB = Number(b.codigoProveedor);
      const validA =
        !Number.isNaN(numA) &&
        a.codigoProveedor != null &&
        a.codigoProveedor !== '' &&
        a.codigoProveedor !== 'S/N';
      const validB =
        !Number.isNaN(numB) &&
        b.codigoProveedor != null &&
        b.codigoProveedor !== '' &&
        b.codigoProveedor !== 'S/N';
      if (validA && validB) return numA - numB;
      if (validA) return -1;
      if (validB) return 1;
      return (a.nombre || '').localeCompare(b.nombre || '', 'es');
    });
  }

  obtenerProveedores(): Observable<Proveedor[]> {
    this.cargando.set(true);
    return this.http.get<Proveedor[]>(this.apiUrl).pipe(
      map((remotos) => this.fusionarConCatalogo(remotos)),
      tap((lista) => {
        this.proveedores.set(lista);
        this.cargando.set(false);
      }),
      catchError(() => {
        const fallback = this.fusionarConCatalogo([]);
        this.proveedores.set(fallback);
        this.cargando.set(false);
        return of(fallback);
      })
    );
  }

  crearProveedor(nuevoProveedor: {
    codigoProveedor?: string;
    rfc: string;
    nombre: string;
    regimenFiscal: string;
  }): Observable<Proveedor> {
    const rfcUpper = nuevoProveedor.rfc.trim().toUpperCase();
    const codigo = resolverCodigoProveedor(
      rfcUpper,
      nuevoProveedor.codigoProveedor
    );
    const payload = {
      ...nuevoProveedor,
      rfc: rfcUpper,
      codigoProveedor: codigo !== 'S/N' ? codigo : undefined,
    };

    this.desmarcarEliminadoLocal(rfcUpper);
    this.guardarOverrideLocal({
      rfc: rfcUpper,
      nombre: nuevoProveedor.nombre.trim(),
      regimenFiscal: nuevoProveedor.regimenFiscal.trim() || (rfcUpper.length === 12 ? '601' : '612'),
      codigoProveedor: codigo,
    });

    return this.http.post<Proveedor>(this.apiUrl, payload).pipe(
      tap(() => this.obtenerProveedores().subscribe()),
      catchError(() => {
        this.obtenerProveedores().subscribe();
        return of(payload as Proveedor);
      })
    );
  }

  actualizarProveedor(
    rfc: string,
    datosActualizados: {
      codigoProveedor?: string;
      nombre?: string;
      regimenFiscal?: string;
    }
  ): Observable<Proveedor> {
    const rfcUpper = rfc.trim().toUpperCase();
    const existente =
      this.proveedores().find((p) => p.rfc.toUpperCase() === rfcUpper) ||
      obtenerDatosCatalogoPorRfc(rfcUpper);

    const actualizadoLocal: Proveedor = {
      rfc: rfcUpper,
      nombre: datosActualizados.nombre?.trim() || existente?.nombre || '',
      regimenFiscal:
        datosActualizados.regimenFiscal?.trim() ||
        existente?.regimenFiscal ||
        (rfcUpper.length === 12 ? '601' : '612'),
      codigoProveedor:
        datosActualizados.codigoProveedor?.trim() ||
        existente?.codigoProveedor ||
        'S/N',
    };

    this.guardarOverrideLocal(actualizadoLocal);

    return this.http
      .patch<Proveedor>(`${this.apiUrl}/${encodeURIComponent(rfcUpper)}`, {
        nombre: actualizadoLocal.nombre,
        regimenFiscal: actualizadoLocal.regimenFiscal,
        codigoProveedor:
          actualizadoLocal.codigoProveedor !== 'S/N'
            ? actualizadoLocal.codigoProveedor
            : undefined,
      })
      .pipe(
        tap(() => this.obtenerProveedores().subscribe()),
        catchError(() => {
          this.obtenerProveedores().subscribe();
          return of(actualizadoLocal);
        })
      );
  }

  eliminarProveedor(rfc: string): Observable<any> {
    const rfcUpper = rfc.trim().toUpperCase();
    this.marcarEliminadoLocal(rfcUpper);
    return this.http
      .delete(`${this.apiUrl}/${encodeURIComponent(rfcUpper)}`)
      .pipe(
        tap(() => this.obtenerProveedores().subscribe()),
        catchError(() => {
          this.obtenerProveedores().subscribe();
          return of({ eliminado: true });
        })
      );
  }

  importarProveedoresLote(
    lote: Array<{
      codigoProveedor: string;
      rfc: string;
      nombre: string;
      regimenFiscal: string;
    }>
  ): Observable<any> {
    for (const item of lote) {
      if (!item.rfc || !item.nombre) continue;
      const rfcUpper = item.rfc.trim().toUpperCase();
      this.desmarcarEliminadoLocal(rfcUpper);
      this.guardarOverrideLocal({
        codigoProveedor: item.codigoProveedor?.trim() || 'S/N',
        rfc: rfcUpper,
        nombre: item.nombre.trim(),
        regimenFiscal:
          item.regimenFiscal?.trim() ||
          (rfcUpper.length === 12 ? '601' : '612'),
      });
    }

    return this.http
      .post(`${this.apiUrl}/bulk`, { proveedores: lote })
      .pipe(
        tap(() => this.obtenerProveedores().subscribe()),
        catchError(() => {
          this.obtenerProveedores().subscribe();
          return of({ procesados: lote.length });
        })
      );
  }
}
