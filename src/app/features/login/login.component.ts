// login.component.ts
import { Component, inject } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { LogoXmlFlowComponent } from '../../shared/components/logo-xml-flow/logo-xml-flow.component';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LogoXmlFlowComponent],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  loginForm: FormGroup;

  private readonly router = inject(Router)

  constructor(
    private fb: FormBuilder, 
    private authService: AuthService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
  }

  onSubmit() {
    if (this.loginForm.invalid) {
      console.log('Faltan datos o son incorrectos');
      return;
    }

    const { email, password } = this.loginForm.value;

    this.authService.login(email, password).subscribe({
      next: (response) => {
        console.log('Login exitoso:', response);
        this.router.navigateByUrl('/dashboard')
      },
      error: (error) => {
        console.error('Error al iniciar sesión:', error);
      }
    });
  }
}