import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QueryInput } from './query-input';

describe('QueryInput', () => {
  let component: QueryInput;
  let fixture: ComponentFixture<QueryInput>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QueryInput]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QueryInput);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
