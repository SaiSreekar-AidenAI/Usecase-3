import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OverviewTab } from './overview-tab';

describe('OverviewTab', () => {
  let component: OverviewTab;
  let fixture: ComponentFixture<OverviewTab>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OverviewTab]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OverviewTab);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
