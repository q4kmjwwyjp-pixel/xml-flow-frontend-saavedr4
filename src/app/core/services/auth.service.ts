import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api.config';

export type RolUsuario = 'admin' | 'operador';

export interface SesionUsuario {
  usuario: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
}

const STORAGE_KEY_SESION = 'xmlflow_sesion_v2';
const STORAGE_KEY_LEGACY = 'xmlflow_usuario';
const STORAGE_KEY_PRUEBAS = 'xmlflow_admin_mostrar_pruebas';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = `${API_URL}/auth`;

  readonly usuarioActual = signal<SesionUsuario | null>(
    this.cargarSesionInicial()
  );

  readonly mostrarDatosPrueba = signal<boolean>(
    this.cargarPreferenciaPruebasInicial()
  );

  readonly estaAutenticado = computed(() => !!this.usuarioActual());

  readonly esAdmin = computed(() => this.usuarioActual()?.rol === 'admin');

  readonly etiquetaUsuario = computed(() => {
    const u = this.usuarioActual();
    if (!u) return 'Sin sesión';
    return u.rol === 'admin'
      ? 'Administrador'
      : 'Daniela (Operaciones)';
  });

  constructor(private http: HttpClient) {}

  login(email: string, password: string): Observable<any> {
    const body = { email, password };
    return this.http.post(this.apiUrl, body);
  }

  guardarSesion(sesion: SesionUsuario): void {
    this.usuarioActual.set(sesion);
    if (sesion.rol !== 'admin') {
      this.mostrarDatosPrueba.set(false);
    } else {
      this.mostrarDatosPrueba.set(this.cargarPreferenciaPruebasInicial());
    }

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(STORAGE_KEY_SESION, JSON.stringify(sesion));
      sessionStorage.setItem(STORAGE_KEY_LEGACY, sesion.usuario);
    }
  }

  cerrarSesion(): void {
    this.usuarioActual.set(null);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEY_SESION);
      sessionStorage.removeItem(STORAGE_KEY_LEGACY);
    }
  }

  toggleMostrarDatosPrueba(): void {
    if (!this.esAdmin()) return;
    const nuevoValor = !this.mostrarDatosPrueba();
    this.mostrarDatosPrueba.set(nuevoValor);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(STORAGE_KEY_PRUEBAS, String(nuevoValor));
    }
  }

  esFacturaDePrueba(f: any): boolean {
    if (!f) return false;
    const uuid = String(f.uuid || '').toUpperCase();
    const folio = String(f.folio || '').toUpperCase();
    const serie = String(f.serie || '').toUpperCase();
    const nombre = String(f.nombreProveedor || '').toUpperCase();
    const rfc = String(f.rfcEmisor || '').toUpperCase();

    return (
      uuid.startsWith('PRUEBA-UUID-') ||
      folio.startsWith('PRUEBAS') ||
      serie === 'PRUEBAS' ||
      nombre.includes('[PRUEBAS]') ||
      rfc.startsWith('PRU0')
    );
  }

  esProveedorDePrueba(p: any): boolean {
    if (!p) return false;
    const rfc = String(p.rfc || '').toUpperCase();
    const nombre = String(p.nombre || '').toUpperCase();
    return rfc.startsWith('PRU0') || nombre.includes('[PRUEBAS]');
  }

  debeMostrarFactura(f: any): boolean {
    if (this.esAdmin() && this.mostrarDatosPrueba()) {
      return true;
    }
    return !this.esFacturaDePrueba(f);
  }

  debeMostrarProveedor(p: any): boolean {
    if (this.esAdmin() && this.mostrarDatosPrueba()) {
      return true;
    }
    return !this.esProveedorDePrueba(p);
  }

  private cargarSesionInicial(): SesionUsuario | null {
    if (typeof sessionStorage === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY_SESION);
      if (raw) {
        return JSON.parse(raw) as SesionUsuario;
      }
      const legacy = sessionStorage.getItem(STORAGE_KEY_LEGACY);
      if (legacy) {
        const lower = legacy.toLowerCase();
        const esAdmin = lower.startsWith('admin');
        return {
          usuario: esAdmin ? 'admin' : 'daniela',
          nombre: esAdmin ? 'Administrador' : 'Daniela',
          email: esAdmin ? 'admin@xmlflow.com' : 'daniela@xmlflow.com',
          rol: esAdmin ? 'admin' : 'operador',
        };
      }
    } catch {
      return null;
    }
    return null;
  }

  private cargarPreferenciaPruebasInicial(): boolean {
    if (typeof sessionStorage === 'undefined') return true;
    const guardado = sessionStorage.getItem(STORAGE_KEY_PRUEBAS);
    return guardado === null ? true : guardado === 'true';
  }
}
