import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { API_URL } from '../../core/config/api.config';
import { AuthService } from '../../core/services/auth.service';
import { LogoXmlFlowComponent } from '../../shared/components/logo-xml-flow/logo-xml-flow.component';

type EstadoLogin = 'inicial' | 'cargando' | 'error' | 'exito';

/**
 * Interfaz de Login (rol Administrador)
 * --------------------------------------
 * Responsabilidad de Persona 5. El endpoint real de autenticación todavía
 * no existe (lo entrega Backend), así que este componente:
 *   1) Valida en el cliente que correo/RFC y contraseña no estén vacíos.
 *   2) Llama a AuthService.login(), que simula la petición HTTP.
 *   3) Refleja 3 estados visuales: cargando, error y éxito simulado.
 *   4) Al autenticar, navega a /dashboard (Interfaz 1, Persona 3).
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LogoXmlFlowComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly estado = signal<EstadoLogin>('inicial');
  readonly mensajeError = signal<string>('');
  readonly mostrarPassword = signal(false);
  readonly apiUrl = API_URL;

  readonly form = this.fb.nonNullable.group({
    usuario: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  get usuarioInvalido(): boolean {
    const c = this.form.controls.usuario;
    return c.invalid && (c.dirty || c.touched);
  }

  get passwordInvalido(): boolean {
    const c = this.form.controls.password;
    return c.invalid && (c.dirty || c.touched);
  }

  togglePassword(): void {
    this.mostrarPassword.update((v) => !v);
  }

  enviar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.estado.set('cargando');
    this.mensajeError.set('');

    this.authService.login(this.form.getRawValue()).subscribe({
      next: () => {
        this.estado.set('exito');
        // Pequeña pausa para que el usuario alcance a ver la confirmación
        // antes de redirigir al Dashboard de operaciones (Interfaz 1).
        setTimeout(() => this.router.navigateByUrl('/dashboard'), 900);
      },
      error: (err) => {
        this.estado.set('error');
        this.mensajeError.set(err?.mensaje ?? 'No se pudo iniciar sesión. Intenta de nuevo.');
      },
    });
  }
}
