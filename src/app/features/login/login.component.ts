// login.component.ts
import { Component } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { LogoXmlFlowComponent } from '../../shared/components/logo-xml-flow/logo-xml-flow.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LogoXmlFlowComponent],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  loginForm: FormGroup;

  constructor(
    private fb: FormBuilder, 
    private authService: AuthService
  ) {
    // Inicializamos el formulario con validaciones básicas
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
  }

  onSubmit() {
    // Si el formulario es inválido, detenemos la ejecución
    if (this.loginForm.invalid) {
      console.log('Faltan datos o son incorrectos');
      return;
    }

    // Extraemos los datos validados
    const { email, password } = this.loginForm.value;

    this.authService.login(email, password).subscribe({
      next: (response) => {
        console.log('Login exitoso:', response);
      },
      error: (error) => {
        console.error('Error al iniciar sesión:', error);
      }
    });
  }
}