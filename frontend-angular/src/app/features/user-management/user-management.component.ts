import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ViewEncapsulation,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import { ButtonComponent } from '../../shared/ui/button.component';
import { User } from '../../core/types';

interface FormData {
  name: string;
  email: string;
  role: 'admin' | 'associate';
  password: string;
  is_active: boolean;
}

const EMPTY_FORM: FormData = {
  name: '',
  email: '',
  role: 'associate',
  password: '',
  is_active: true,
};

/**
 * Admin-only user CRUD page. Same UX as the React UserManagement component:
 * a row list with role badges + status dot, plus a centered modal for
 * add/edit. Modal uses ngModel two-way binding for form fields.
 */
@Component({
  selector: 'app-user-management',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [FormsModule, ButtonComponent],
  styleUrl: './user-management.component.css',
  template: `
    <div class="user-mgmt">
      <div class="user-mgmt__header">
        <div>
          <h2 class="user-mgmt__title">User Management</h2>
          <p class="user-mgmt__subtitle">Manage users and their roles</p>
        </div>
        <app-button variant="primary" (click)="openAdd()">+ Add User</app-button>
      </div>

      @if (loading()) {
        <p class="user-mgmt__empty">Loading users...</p>
      } @else if (users().length === 0) {
        <p class="user-mgmt__empty">No users found</p>
      } @else {
        <div class="user-mgmt__list">
          @for (user of users(); track user.id) {
            <div class="user-mgmt__user-card">
              <div class="user-mgmt__user-info">
                <span class="user-mgmt__user-name">{{ user.name }}</span>
                <span class="user-mgmt__user-email">{{ user.email }}</span>
              </div>
              <div class="user-mgmt__user-badges">
                <span
                  class="user-mgmt__role-badge"
                  [class.user-mgmt__role-badge--admin]="user.role === 'admin'"
                  [class.user-mgmt__role-badge--associate]="user.role === 'associate'"
                >
                  {{ user.role }}
                </span>
                <span
                  class="user-mgmt__status-dot"
                  [class.user-mgmt__status-dot--active]="user.is_active !== false"
                  [class.user-mgmt__status-dot--inactive]="user.is_active === false"
                  [title]="user.is_active !== false ? 'Active' : 'Inactive'"
                ></span>
              </div>
              <div class="user-mgmt__user-actions">
                <app-button variant="ghost" (click)="openEdit(user)">Edit</app-button>
                <app-button variant="danger" (click)="confirmDelete(user)">
                  Delete
                </app-button>
              </div>
            </div>
          }
        </div>
      }

      @if (modalOpen()) {
        <div class="user-mgmt__modal-overlay" (click)="closeModal()">
          <div class="user-mgmt__modal" (click)="$event.stopPropagation()">
            <h3 class="user-mgmt__modal-title">
              {{ modalMode() === 'add' ? 'Add User' : 'Edit User' }}
            </h3>

            <div class="user-mgmt__modal-form">
              <div class="user-mgmt__field">
                <label class="user-mgmt__field-label">Name</label>
                <input
                  class="user-mgmt__field-input"
                  placeholder="Full name"
                  [(ngModel)]="form.name"
                  name="name"
                  autofocus
                />
              </div>

              <div class="user-mgmt__field">
                <label class="user-mgmt__field-label">Email</label>
                <input
                  class="user-mgmt__field-input"
                  type="email"
                  placeholder="user@company.com"
                  [(ngModel)]="form.email"
                  name="email"
                  [disabled]="modalMode() === 'edit'"
                />
              </div>

              <div class="user-mgmt__field">
                <label class="user-mgmt__field-label">Role</label>
                <select
                  class="user-mgmt__field-select"
                  [(ngModel)]="form.role"
                  name="role"
                >
                  <option value="associate">Associate</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              @if (form.role === 'admin') {
                <div class="user-mgmt__field user-mgmt__field--anim">
                  <label class="user-mgmt__field-label">
                    Password{{ modalMode() === 'edit' ? ' (leave blank to keep current)' : '' }}
                  </label>
                  <input
                    class="user-mgmt__field-input"
                    type="password"
                    [placeholder]="modalMode() === 'edit' ? 'Unchanged' : 'Enter password'"
                    [(ngModel)]="form.password"
                    name="password"
                  />
                </div>
              }

              @if (modalMode() === 'edit') {
                <div class="user-mgmt__field">
                  <label class="user-mgmt__field-label">Status</label>
                  <select
                    class="user-mgmt__field-select"
                    [ngModel]="form.is_active ? 'active' : 'inactive'"
                    (ngModelChange)="form.is_active = $event === 'active'"
                    name="status"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              }

              @if (modalError(); as err) {
                <div class="user-mgmt__modal-error">{{ err }}</div>
              }

              <div class="user-mgmt__modal-actions">
                <app-button
                  variant="ghost"
                  [disabled]="saving()"
                  (click)="closeModal()"
                >
                  Cancel
                </app-button>
                <app-button
                  variant="primary"
                  [disabled]="saving()"
                  (click)="onSave()"
                >
                  {{ saving() ? 'Saving...' : 'Save' }}
                </app-button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class UserManagementComponent {
  private api = inject(ApiService);
  private cdr = inject(ChangeDetectorRef);

  protected users = signal<User[]>([]);
  protected loading = signal<boolean>(true);
  protected modalOpen = signal<boolean>(false);
  protected modalMode = signal<'add' | 'edit'>('add');
  protected editingUser = signal<User | null>(null);
  protected modalError = signal<string | null>(null);
  protected saving = signal<boolean>(false);

  protected form: FormData = { ...EMPTY_FORM };

  constructor() {
    void this.loadUsers();
  }

  private async loadUsers(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await firstValueFrom(this.api.fetchUsers());
      this.users.set(data);
    } catch {
      /* ignore */
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  openAdd(): void {
    this.form = { ...EMPTY_FORM };
    this.modalError.set(null);
    this.modalMode.set('add');
    this.editingUser.set(null);
    this.modalOpen.set(true);
  }

  openEdit(user: User): void {
    this.form = {
      name: user.name,
      email: user.email,
      role: user.role,
      password: '',
      is_active: user.is_active !== false,
    };
    this.modalError.set(null);
    this.modalMode.set('edit');
    this.editingUser.set(user);
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.modalError.set(null);
  }

  async onSave(): Promise<void> {
    this.modalError.set(null);

    if (!this.form.name.trim()) {
      this.modalError.set('Name is required');
      return;
    }
    if (this.modalMode() === 'add' && !this.form.email.trim()) {
      this.modalError.set('Email is required');
      return;
    }
    if (
      this.form.role === 'admin' &&
      this.modalMode() === 'add' &&
      !this.form.password
    ) {
      this.modalError.set('Password is required for admin accounts');
      return;
    }

    this.saving.set(true);
    try {
      if (this.modalMode() === 'add') {
        await firstValueFrom(
          this.api.createUser({
            name: this.form.name.trim(),
            email: this.form.email.trim(),
            role: this.form.role,
            password: this.form.password || undefined,
          }),
        );
      } else {
        const editing = this.editingUser();
        if (editing) {
          await firstValueFrom(
            this.api.updateUser(editing.id, {
              name: this.form.name.trim(),
              role: this.form.role,
              password: this.form.password || undefined,
              is_active: this.form.is_active,
            }),
          );
        }
      }
      this.closeModal();
      await this.loadUsers();
    } catch (err: unknown) {
      this.modalError.set(err instanceof Error ? err.message : 'Failed to save user');
    } finally {
      this.saving.set(false);
    }
  }

  async confirmDelete(user: User): Promise<void> {
    if (!window.confirm(`Delete user "${user.name}" (${user.email})?`)) return;
    try {
      await firstValueFrom(this.api.deleteUser(user.id));
      await this.loadUsers();
    } catch {
      /* ignore */
    }
  }
}
