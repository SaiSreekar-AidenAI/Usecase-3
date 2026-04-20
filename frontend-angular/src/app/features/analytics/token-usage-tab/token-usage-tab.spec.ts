import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TokenUsageTab } from './token-usage-tab';

describe('TokenUsageTab', () => {
  let component: TokenUsageTab;
  let fixture: ComponentFixture<TokenUsageTab>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TokenUsageTab]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TokenUsageTab);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
