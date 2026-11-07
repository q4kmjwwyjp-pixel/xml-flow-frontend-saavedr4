import { Component, OnDestroy, inject, signal } from '@angular/core';
import { AuthService, SesionUsuario } from '../../core/services/auth.service';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { LogoXmlFlowComponent } from '../../shared/components/logo-xml-flow/logo-xml-flow.component';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LogoXmlFlowComponent],
  templateUrl: './login.component.html',
})
export class LoginComponent implements OnDestroy {
  loginForm: FormGroup;

  mostrarPassword = signal<boolean>(false);
  cargando = signal<boolean>(false);
  mensajeError = signal<string | null>(null);

  private readonly router = inject(Router);
  private formSub?: Subscription;
  private loginTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService
  ) {
    this.loginForm = this.fb.group({
      usuario: ['', [Validators.required]],
      password: ['', [Validators.required]],
    });

    this.formSub = this.loginForm.valueChanges.subscribe(() => {
      if (this.mensajeError()) {
        this.mensajeError.set(null);
      }
    });
  }

  ngOnDestroy(): void {
    this.formSub?.unsubscribe();
    if (this.loginTimer) {
      clearTimeout(this.loginTimer);
    }
  }

  toggleMostrarPassword(): void {
    this.mostrarPassword.update((v) => !v);
  }

  limpiarErrorAlEscribir(): void {
    if (this.mensajeError()) {
      this.mensajeError.set(null);
    }
  }

  onSubmit(): void {
    if (this.cargando()) return;

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.mensajeError.set(
        'Por favor ingresa tu usuario y contraseña para continuar.'
      );
      return;
    }

    const usuarioRaw: string = this.loginForm.value.usuario ?? '';
    const password: string = this.loginForm.value.password ?? '';
    const usuario = usuarioRaw.trim();
    const usuarioLower = usuario.toLowerCase();

    if (!usuario || !password) {
      this.mensajeError.set(
        'Por favor ingresa tu usuario y contraseña para continuar.'
      );
      return;
    }

    this.cargando.set(true);
    this.mensajeError.set(null);

    // 1. Validación de las 2 cuentas oficiales: Admin y Daniela
    const esCuentaAdmin =
      usuarioLower === 'admin' && password === '250105';

    if (usuarioLower === 'admin' || usuarioLower.startsWith('admin@')) {
      if (!esCuentaAdmin) {
        this.cargando.set(false);
        this.mensajeError.set(
          'Usuario o contraseña incorrectos. Verifica tus datos e intenta nuevamente.'
        );
        return;
      }
    }

    const esCuentaDaniela =
      (usuarioLower === 'daniela' || usuarioLower === 'daniela@xmlflow.com') &&
      password === 'Dani4829';

    if (esCuentaAdmin || esCuentaDaniela) {
      const sesion: SesionUsuario = esCuentaAdmin
        ? {
            usuario: 'admin',
            nombre: 'Administrador',
            email: 'admin@xmlflow.com',
            rol: 'admin',
          }
        : {
            usuario: 'daniela',
            nombre: 'Daniela',
            email: 'daniela@xmlflow.com',
            rol: 'operador',
          };

      // Despertar/validar también contra el backend en segundo plano
      this.authService.login(sesion.email, password).subscribe({
        error: () => {},
      });

      this.loginTimer = setTimeout(() => {
        this.cargando.set(false);
        this.authService.guardarSesion(sesion);
        this.router.navigateByUrl('/dashboard');
      }, 450);
      return;
    }

    // 2. Respaldo contra el backend
    this.authService.login(usuario, password).subscribe({
      next: (response) => {
        this.cargando.set(false);
        if (response) {
          const esAdmin =
            response?.rol === 'admin' || usuarioLower.startsWith('admin');
          const sesion: SesionUsuario = {
            usuario: esAdmin ? 'admin' : 'daniela',
            nombre: esAdmin ? 'Administrador' : 'Daniela',
            email: esAdmin ? 'admin@xmlflow.com' : 'daniela@xmlflow.com',
            rol: esAdmin ? 'admin' : 'operador',
          };
          this.authService.guardarSesion(sesion);
          this.router.navigateByUrl('/dashboard');
        } else {
          this.mensajeError.set(
            'Usuario o contraseña incorrectos. Verifica tus datos e intenta nuevamente.'
          );
        }
      },
      error: () => {
        this.cargando.set(false);
        this.mensajeError.set(
          'Usuario o contraseña incorrectos. Verifica tus datos e intenta nuevamente.'
        );
      },
    });
  }
}
