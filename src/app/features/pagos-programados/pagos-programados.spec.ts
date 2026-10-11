import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PagosProgramados } from './pagos-programados';

describe('PagosProgramados', () => {
  let component: PagosProgramados;
  let fixture: ComponentFixture<PagosProgramados>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PagosProgramados],
    }).compileComponents();

    fixture = TestBed.createComponent(PagosProgramados);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
