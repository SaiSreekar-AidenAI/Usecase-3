import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GenerateView } from './generate-view';

describe('GenerateView', () => {
  let component: GenerateView;
  let fixture: ComponentFixture<GenerateView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GenerateView]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GenerateView);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
