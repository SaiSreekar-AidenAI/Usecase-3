import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LayoutShell } from './layout-shell';

describe('LayoutShell', () => {
  let component: LayoutShell;
  let fixture: ComponentFixture<LayoutShell>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LayoutShell]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LayoutShell);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
