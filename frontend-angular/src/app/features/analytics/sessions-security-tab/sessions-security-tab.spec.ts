import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SessionsSecurityTab } from './sessions-security-tab';

describe('SessionsSecurityTab', () => {
  let component: SessionsSecurityTab;
  let fixture: ComponentFixture<SessionsSecurityTab>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SessionsSecurityTab]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SessionsSecurityTab);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
