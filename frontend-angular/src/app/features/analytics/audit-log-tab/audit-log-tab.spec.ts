import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuditLogTab } from './audit-log-tab';

describe('AuditLogTab', () => {
  let component: AuditLogTab;
  let fixture: ComponentFixture<AuditLogTab>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuditLogTab]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AuditLogTab);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
