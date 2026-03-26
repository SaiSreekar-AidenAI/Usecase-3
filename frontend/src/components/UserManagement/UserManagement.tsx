import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User } from '../../types';
import { fetchUsers, createUserApi, updateUserApi, deleteUserApi } from '../../services/api';
import { Button } from '../common/Button';
import './UserManagement.css';

interface ModalState {
  open: boolean;
  mode: 'add' | 'edit';
  user?: User;
}

interface FormData {
  name: string;
  email: string;
  role: string;
  password: string;
  is_active: boolean;
}

const emptyForm: FormData = { name: '', email: '', role: 'associate', password: '', is_active: true };

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>({ open: false, mode: 'add' });
  const [form, setForm] = useState<FormData>(emptyForm);
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch {
      // Silently fail; users can retry
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const openAdd = () => {
    setForm(emptyForm);
    setModalError(null);
    setModal({ open: true, mode: 'add' });
  };

  const openEdit = (user: User) => {
    setForm({
      name: user.name,
      email: user.email,
      role: user.role,
      password: '',
      is_active: user.is_active !== false,
    });
    setModalError(null);
    setModal({ open: true, mode: 'edit', user });
  };

  const closeModal = () => {
    setModal({ open: false, mode: 'add' });
    setModalError(null);
  };

  const handleSave = async () => {
    setModalError(null);

    if (!form.name.trim()) {
      setModalError('Name is required');
      return;
    }
    if (modal.mode === 'add' && !form.email.trim()) {
      setModalError('Email is required');
      return;
    }
    if (form.role === 'admin' && modal.mode === 'add' && !form.password) {
      setModalError('Password is required for admin accounts');
      return;
    }

    setSaving(true);
    try {
      if (modal.mode === 'add') {
        await createUserApi({
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
          password: form.password || undefined,
        });
      } else if (modal.user) {
        await updateUserApi(modal.user.id, {
          name: form.name.trim(),
          role: form.role,
          password: form.password || undefined,
          is_active: form.is_active,
        });
      }
      closeModal();
      await loadUsers();
    } catch (err: any) {
      setModalError(err.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user: User) => {
    if (!window.confirm(`Delete user "${user.name}" (${user.email})?`)) return;
    try {
      await deleteUserApi(user.id);
      await loadUsers();
    } catch {
      // Silently fail
    }
  };

  return (
    <div className="user-mgmt">
      <div className="user-mgmt__header">
        <div>
          <h2 className="user-mgmt__title">User Management</h2>
          <p className="user-mgmt__subtitle">Manage users and their roles</p>
        </div>
        <Button variant="primary" onClick={openAdd}>
          + Add User
        </Button>
      </div>

      {loading ? (
        <p className="user-mgmt__empty">Loading users...</p>
      ) : users.length === 0 ? (
        <p className="user-mgmt__empty">No users found</p>
      ) : (
        <div className="user-mgmt__list">
          <AnimatePresence>
            {users.map((user) => (
              <motion.div
                key={user.id}
                className="user-mgmt__user-card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                layout
              >
                <div className="user-mgmt__user-info">
                  <span className="user-mgmt__user-name">{user.name}</span>
                  <span className="user-mgmt__user-email">{user.email}</span>
                </div>
                <div className="user-mgmt__user-badges">
                  <span
                    className={`user-mgmt__role-badge user-mgmt__role-badge--${user.role}`}
                  >
                    {user.role}
                  </span>
                  <span
                    className={`user-mgmt__status-dot user-mgmt__status-dot--${
                      user.is_active !== false ? 'active' : 'inactive'
                    }`}
                    title={user.is_active !== false ? 'Active' : 'Inactive'}
                  />
                </div>
                <div className="user-mgmt__user-actions">
                  <Button variant="ghost" onClick={() => openEdit(user)}>
                    Edit
                  </Button>
                  <Button variant="danger" onClick={() => handleDelete(user)}>
                    Delete
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {modal.open && (
          <motion.div
            className="user-mgmt__modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeModal}
          >
            <motion.div
              className="user-mgmt__modal"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="user-mgmt__modal-title">
                {modal.mode === 'add' ? 'Add User' : 'Edit User'}
              </h3>

              <div className="user-mgmt__modal-form">
                <div className="user-mgmt__field">
                  <label className="user-mgmt__field-label">Name</label>
                  <input
                    className="user-mgmt__field-input"
                    placeholder="Full name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    autoFocus
                  />
                </div>

                <div className="user-mgmt__field">
                  <label className="user-mgmt__field-label">Email</label>
                  <input
                    className="user-mgmt__field-input"
                    type="email"
                    placeholder="user@company.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    disabled={modal.mode === 'edit'}
                  />
                </div>

                <div className="user-mgmt__field">
                  <label className="user-mgmt__field-label">Role</label>
                  <select
                    className="user-mgmt__field-select"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                  >
                    <option value="associate">Associate</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                {form.role === 'admin' && (
                  <motion.div
                    className="user-mgmt__field"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <label className="user-mgmt__field-label">
                      Password {modal.mode === 'edit' && '(leave blank to keep current)'}
                    </label>
                    <input
                      className="user-mgmt__field-input"
                      type="password"
                      placeholder={modal.mode === 'edit' ? 'Unchanged' : 'Enter password'}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                    />
                  </motion.div>
                )}

                {modal.mode === 'edit' && (
                  <div className="user-mgmt__field">
                    <label className="user-mgmt__field-label">Status</label>
                    <select
                      className="user-mgmt__field-select"
                      value={form.is_active ? 'active' : 'inactive'}
                      onChange={(e) =>
                        setForm({ ...form, is_active: e.target.value === 'active' })
                      }
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                )}

                {modalError && (
                  <motion.div
                    className="user-mgmt__modal-error"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    {modalError}
                  </motion.div>
                )}

                <div className="user-mgmt__modal-actions">
                  <Button variant="ghost" onClick={closeModal} disabled={saving}>
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
