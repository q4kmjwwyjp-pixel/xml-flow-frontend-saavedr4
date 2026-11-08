import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap, catchError, map, throwError } from 'rxjs';
import {
  CATALOGO_PROVEEDORES,
  obtenerDatosCatalogoPorRfc,
  resolverCodigoProveedor,
} from '../utils/catalogo-proveedores';
import { API_URL } from '../config/api.config';

export interface Proveedor {
  id?: number;
  codigoProveedor?: string;
  rfc: string;
  nombre: string;
  regimenFiscal: string;
  /** Columna "Cond. Pag./Prov." del catálogo oficial (días de crédito) */
  diasCredito?: number | null;
  activo?: boolean;
}

const STORAGE_OVERRIDES_KEY = 'xmlflow_proveedores_overrides_v1';
const STORAGE_DELETED_KEY = 'xmlflow_proveedores_deleted_v1';

@Injectable({
  providedIn: 'root',
})
export class ProveedorService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${API_URL}/proveedor`;

  public proveedores = signal<Proveedor[]>([]);
  public cargando = signal<boolean>(false);

  private normalizarTexto(valor?: string | null): string {
    return (valor || '').trim().replace(/\s+/g, ' ').toUpperCase();
  }

  private normalizarCodigo(valor?: string | null): string {
    const limpio = (valor || '').trim().replace(/^#+/, '').trim().toUpperCase();
    return limpio === 'S/N' ? '' : limpio;
  }

  public validarDuplicados(
    datos: {
      codigoProveedor?: string;
      rfc: string;
      nombre: string;
    },
    modoEdicion = false
  ): string | null {
    const listaActual =
      this.proveedores().length > 0
        ? this.proveedores()
        : this.fusionarConCatalogo([]);

    const codigoInput = (datos.codigoProveedor || '')
      .trim()
      .replace(/^#+/, '')
      .trim();
    const codigoNorm = this.normalizarCodigo(codigoInput);
    const rfcInput = (datos.rfc || '').trim().toUpperCase();
    const rfcNorm = this.normalizarTexto(rfcInput);
    const nombreInput = (datos.nombre || '').trim().replace(/\s+/g, ' ');
    const nombreNorm = this.normalizarTexto(nombreInput);

    const candidatos = modoEdicion
      ? listaActual.filter((p) => this.normalizarTexto(p.rfc) !== rfcNorm)
      : listaActual;

    const errores: string[] = [];

    if (codigoNorm) {
      const dupCodigo = candidatos.find(
        (p) => this.normalizarCodigo(p.codigoProveedor) === codigoNorm
      );
      if (dupCodigo) {
        errores.push(
          `El N° de Proveedor (Clave) "${codigoInput}" ya está ocupado por "${dupCodigo.nombre}".`
        );
      }
    }

    if (!modoEdicion && rfcNorm) {
      const dupRfc = candidatos.find(
        (p) => this.normalizarTexto(p.rfc) === rfcNorm
      );
      if (dupRfc) {
        errores.push(
          `El RFC "${rfcInput}" ya está registrado (${dupRfc.nombre}).`
        );
      }
    }

    if (nombreNorm) {
      const dupNombre = candidatos.find(
        (p) => this.normalizarTexto(p.nombre) === nombreNorm
      );
      if (dupNombre) {
        errores.push(
          `La Razón Social "${nombreInput}" ya está registrada (RFC: ${dupNombre.rfc}).`
        );
      }
    }

    return errores.length > 0 ? errores.join(' ') : null;
  }

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

  private eliminarOverrideLocal(rfc: string): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const actual = this.leerOverridesLocales();
      delete actual[rfc.toUpperCase()];
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
        diasCredito: item.diasCredito ?? null,
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
        diasCredito: p.diasCredito ?? previo?.diasCredito ?? null,
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
        diasCredito:
          ov.diasCredito !== undefined
            ? ov.diasCredito
            : previo?.diasCredito ?? null,
      });
    }

    // 4. Deduplicar por Código de Proveedor y Razón Social para evitar registros repetidos
    const codigosVistos = new Set<string>();
    const nombresVistos = new Set<string>();
    const unicos: Proveedor[] = [];

    for (const p of mapa.values()) {
      const codNorm = this.normalizarCodigo(p.codigoProveedor);
      const nomNorm = this.normalizarTexto(p.nombre);

      if (
        (codNorm && codigosVistos.has(codNorm)) ||
        (nomNorm && nombresVistos.has(nomNorm))
      ) {
        continue;
      }

      if (codNorm) codigosVistos.add(codNorm);
      if (nomNorm) nombresVistos.add(nomNorm);
      unicos.push(p);
    }

    return unicos.sort((a, b) => {
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
    const conflicto = this.validarDuplicados(nuevoProveedor, false);
    if (conflicto) {
      return throwError(() => new Error(conflicto));
    }

    const rfcUpper = nuevoProveedor.rfc.trim().toUpperCase();
    const codigoLimpio = (nuevoProveedor.codigoProveedor || '')
      .trim()
      .replace(/^#+/, '')
      .trim();
    const codigo = codigoLimpio || 'S/N';
    const payload = {
      ...nuevoProveedor,
      rfc: rfcUpper,
      nombre: nuevoProveedor.nombre.trim().replace(/\s+/g, ' '),
      codigoProveedor: codigo !== 'S/N' ? codigo : undefined,
    };

    this.desmarcarEliminadoLocal(rfcUpper);
    this.guardarOverrideLocal({
      rfc: rfcUpper,
      nombre: payload.nombre,
      regimenFiscal:
        nuevoProveedor.regimenFiscal.trim() ||
        (rfcUpper.length === 12 ? '601' : '612'),
      codigoProveedor: codigo,
    });

    return this.http.post<Proveedor>(this.apiUrl, payload).pipe(
      tap(() => this.obtenerProveedores().subscribe()),
      catchError((err) => {
        if (err?.status === 409 || err?.status === 400) {
          this.eliminarOverrideLocal(rfcUpper);
          return throwError(() => err);
        }
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
      diasCredito?: number | null;
    }
  ): Observable<Proveedor> {
    const rfcUpper = rfc.trim().toUpperCase();
    const existente =
      this.proveedores().find((p) => p.rfc.toUpperCase() === rfcUpper) ||
      obtenerDatosCatalogoPorRfc(rfcUpper);

    const actualizadoLocal: Proveedor = {
      rfc: rfcUpper,
      nombre:
        datosActualizados.nombre?.trim().replace(/\s+/g, ' ') ||
        existente?.nombre ||
        '',
      regimenFiscal:
        datosActualizados.regimenFiscal?.trim() ||
        existente?.regimenFiscal ||
        (rfcUpper.length === 12 ? '601' : '612'),
      codigoProveedor:
        datosActualizados.codigoProveedor
          ?.trim()
          .replace(/^#+/, '')
          .trim() ||
        existente?.codigoProveedor ||
        'S/N',
      diasCredito:
        datosActualizados.diasCredito !== undefined
          ? datosActualizados.diasCredito !== null &&
            !Number.isNaN(Number(datosActualizados.diasCredito))
            ? Number(datosActualizados.diasCredito)
            : null
          : existente?.diasCredito ?? null,
    };

    const conflicto = this.validarDuplicados(
      {
        codigoProveedor: actualizadoLocal.codigoProveedor,
        rfc: rfcUpper,
        nombre: actualizadoLocal.nombre,
      },
      true
    );
    if (conflicto) {
      return throwError(() => new Error(conflicto));
    }

    const overridesPrevios = this.leerOverridesLocales();
    const overrideAnterior = overridesPrevios[rfcUpper];

    this.guardarOverrideLocal(actualizadoLocal);

    return this.http
      .patch<Proveedor>(`${this.apiUrl}/${encodeURIComponent(rfcUpper)}`, {
        nombre: actualizadoLocal.nombre,
        regimenFiscal: actualizadoLocal.regimenFiscal,
        codigoProveedor:
          actualizadoLocal.codigoProveedor !== 'S/N'
            ? actualizadoLocal.codigoProveedor
            : undefined,
        diasCredito: actualizadoLocal.diasCredito,
      })
      .pipe(
        tap(() => this.obtenerProveedores().subscribe()),
        catchError((err) => {
          if (err?.status === 409 || err?.status === 400) {
            if (overrideAnterior) {
              this.guardarOverrideLocal(overrideAnterior);
            } else {
              this.eliminarOverrideLocal(rfcUpper);
            }
            return throwError(() => err);
          }
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
  ): Observable<{
    nuevos: number;
    omitidos: number;
    totalArchivo: number;
  }> {
    const listaActual =
      this.proveedores().length > 0
        ? this.proveedores()
        : this.fusionarConCatalogo([]);

    const codigosOcupados = new Set<string>();
    const rfcsOcupados = new Set<string>();
    const nombresOcupados = new Set<string>();

    for (const ex of listaActual) {
      const cod = this.normalizarCodigo(ex.codigoProveedor);
      const rfc = this.normalizarTexto(ex.rfc);
      const nom = this.normalizarTexto(ex.nombre);
      if (cod) codigosOcupados.add(cod);
      if (rfc) rfcsOcupados.add(rfc);
      if (nom) nombresOcupados.add(nom);
    }

    const nuevosParaInsertar: Array<{
      codigoProveedor: string;
      rfc: string;
      nombre: string;
      regimenFiscal: string;
    }> = [];
    let omitidos = 0;

    for (const item of lote) {
      if (!item.rfc || !item.nombre) continue;
      const codigoLimpio = (item.codigoProveedor || '')
        .trim()
        .replace(/^#+/, '')
        .trim();
      const rfcUpper = item.rfc.trim().toUpperCase();
      const nombreLimpio = item.nombre.trim().replace(/\s+/g, ' ');
      const regimen =
        item.regimenFiscal?.trim() ||
        (rfcUpper.length === 12 ? '601' : '612');

      const codNorm = this.normalizarCodigo(codigoLimpio);
      const rfcNorm = this.normalizarTexto(rfcUpper);
      const nomNorm = this.normalizarTexto(nombreLimpio);

      // Si ya estaba dado de alta (por Código, RFC o Razón Social), se omite para no duplicar
      if (
        (codNorm && codigosOcupados.has(codNorm)) ||
        rfcsOcupados.has(rfcNorm) ||
        nombresOcupados.has(nomNorm)
      ) {
        omitidos++;
        continue;
      }

      if (codNorm) codigosOcupados.add(codNorm);
      rfcsOcupados.add(rfcNorm);
      nombresOcupados.add(nomNorm);

      this.desmarcarEliminadoLocal(rfcUpper);
      this.guardarOverrideLocal({
        codigoProveedor: codigoLimpio || 'S/N',
        rfc: rfcUpper,
        nombre: nombreLimpio,
        regimenFiscal: regimen,
      });

      nuevosParaInsertar.push({
        codigoProveedor: codigoLimpio,
        rfc: rfcUpper,
        nombre: nombreLimpio,
        regimenFiscal: regimen,
      });
    }

    const resultado = {
      nuevos: nuevosParaInsertar.length,
      omitidos,
      totalArchivo: lote.length,
    };

    if (nuevosParaInsertar.length === 0) {
      this.obtenerProveedores().subscribe();
      return of(resultado);
    }

    return this.http
      .post(`${this.apiUrl}/bulk`, { proveedores: nuevosParaInsertar })
      .pipe(
        tap(() => this.obtenerProveedores().subscribe()),
        map(() => resultado),
        catchError(() => {
          this.obtenerProveedores().subscribe();
          return of(resultado);
        })
      );
  }
}
