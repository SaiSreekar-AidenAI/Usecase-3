import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PromptInput } from './prompt-input';

describe('PromptInput', () => {
  let component: PromptInput;
  let fixture: ComponentFixture<PromptInput>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PromptInput]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PromptInput);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
