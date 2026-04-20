import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PageTransition } from './page-transition';

describe('PageTransition', () => {
  let component: PageTransition;
  let fixture: ComponentFixture<PageTransition>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageTransition]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PageTransition);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
