import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';


@Component({
  imports: [],
  selector: 'app-dashboard',
  styleUrl: './dashboard.css',
  templateUrl: './dashboard.html',
})
export class Dashboard {
  private readonly router = inject(Router)


  goUploadePage() {
    this.router.navigateByUrl('/upload')
  }
}
