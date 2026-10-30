// login.component.ts
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
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

    // Limpiar el mensaje de error automáticamente en cuanto el usuario vuelva a escribir
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
      this.mensajeError.set('Por favor ingresa tu usuario y contraseña para continuar.');
      return;
    }

    const usuarioRaw: string = this.loginForm.value.usuario ?? '';
    const password: string = this.loginForm.value.password ?? '';
    const usuario = usuarioRaw.trim();

    if (!usuario || !password) {
      this.mensajeError.set('Por favor ingresa tu usuario y contraseña para continuar.');
      return;
    }

    this.cargando.set(true);
    this.mensajeError.set(null);

    // 1. Validación directa para credenciales de acceso rápido ("user" / "123")
    if (usuario === 'user' && password === '123') {
      this.loginTimer = setTimeout(() => {
        this.cargando.set(false);
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('xmlflow_usuario', 'user');
        }
        this.router.navigateByUrl('/dashboard');
      }, 600);
      return;
    }

    if (usuario === 'user' && password !== '123') {
      this.loginTimer = setTimeout(() => {
        this.cargando.set(false);
        this.mensajeError.set('Usuario o contraseña incorrectos. Verifica tus datos e intenta nuevamente.');
      }, 500);
      return;
    }

    // 2. Respaldo contra el backend de autenticación para otros usuarios/correos registrados
    this.authService.login(usuario, password).subscribe({
      next: (response) => {
        this.cargando.set(false);
        if (response) {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('xmlflow_usuario', usuario);
          }
          this.router.navigateByUrl('/dashboard');
        } else {
          this.mensajeError.set('Usuario o contraseña incorrectos. Verifica tus datos e intenta nuevamente.');
        }
      },
      error: (error) => {
        console.error('Error al iniciar sesión:', error);
        this.cargando.set(false);
        this.mensajeError.set('Usuario o contraseña incorrectos. Verifica tus datos e intenta nuevamente.');
      },
    });
  }
}
