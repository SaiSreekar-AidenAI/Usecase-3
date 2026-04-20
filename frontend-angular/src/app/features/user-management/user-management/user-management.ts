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

import { ApiService } from '../../../core/services/api.service';
import { Button } from '../../../shared/ui/button/button';
import { User } from '../../../core/types';

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

@Component({
  selector: 'app-user-management',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [FormsModule, Button],
  templateUrl: './user-management.html',
  styleUrl: './user-management.css',
})
export class UserManagement {
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
