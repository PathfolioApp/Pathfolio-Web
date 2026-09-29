import React, { useState } from 'react';
import { Eye, UserRound, Ban, CheckCircle2, Trash2, Mail, UserPlus } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { adminApi } from '../adminApi';
import { PanelHeading, Empty, FilePicker, downloadCsvFile } from '../utils/adminHelpers';

export function UserWorkspace({ users, userImportRows, userImportErrors, userImportSummary, readUserImport, importUsers, promoteUser, saving, loading, reload }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewingUser, setViewingUser] = useState(null);
  const [confirmingBlock, setConfirmingBlock] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(null);
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const filteredUsers = users.filter(user => {
    if (roleFilter && user.role !== roleFilter) return false;
    if (statusFilter === 'blocked' && !user.blocked) return false;
    if (statusFilter === 'active' && user.blocked) return false;
    if (!searchTerm.trim()) return true;
    return `${user.fullName} ${user.email} ${user.rollNumber || ''} ${user.department}`.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const runAction = async action => {
    setActionError(''); setActionMessage('');
    try { await action(); } catch (err) { setActionError(err.message); }
    finally { setConfirmingBlock(null); setConfirmingDelete(null); setViewingUser(null); }
  };

  const toggleBlock = user => runAction(async () => {
    await adminApi.setUserBlocked(user.id, !user.blocked);
    setActionMessage(user.blocked ? `${user.fullName} can sign in again.` : `${user.fullName} has been blocked from the platform.`);
    await reload();
  });

  const removeUser = user => runAction(async () => {
    await adminApi.deleteUser(user.id);
    setActionMessage(`${user.fullName}'s account has been permanently deleted.`);
    await reload();
  });

  const downloadTemplate = () => downloadCsvFile(
    'pathfolio-users-template.csv',
    'fullName,email,password,role,department,batchYear,rollNumber\nExample Student,2024CS101@kiit.ac.in,change-me-123,student,Computer Science,2028,2024CS101\nExample Recruiter,recruiter@company.com,change-me-123,recruiter,Recruitment,Operations,\n'
  );

  return (
    <>
      {actionError && <div className="pf-admin-error" role="alert">{actionError}</div>}
      {actionMessage && <div className="pf-admin-success" role="status">{actionMessage}</div>}
      <section className="pf-admin-import">
        <PanelHeading eyebrow="Directory access" title="Bulk add users" />
        <p className="pf-admin-import-copy">Import student or recruiter accounts in one CSV. Passwords are hashed before storage; users should change temporary passwords after their first sign-in.</p>
        <div className="pf-admin-import-actions">
          <FilePicker accept=".csv,text/csv" onFile={readUserImport}>Choose CSV file</FilePicker>
          <Button variant="outline" size="sm" onClick={downloadTemplate}>Download template</Button>
        </div>
        {userImportRows.length > 0 && (
          <div className="pf-admin-import-preview">
            <strong>Preview: {userImportRows.length} rows</strong>
            {userImportRows.slice(0, 5).map((row, index) => <span key={index}>{row.fullname} · {row.email} · {row.role || 'student'}</span>)}
          </div>
        )}
        {userImportErrors.length > 0 && <div className="pf-admin-import-errors">{userImportErrors.map((item, index) => <span key={index}>Row {item.row}: {item.message}</span>)}</div>}
        {userImportRows.length > 0 && <Button loading={saving} disabled={userImportErrors.length > 0} icon={UserPlus} onClick={importUsers}>Import {userImportRows.length} users</Button>}
        {userImportSummary && <div className="pf-admin-import-summary"><b>Imported {userImportSummary.imported}</b><span>{userImportSummary.errors.length} validation errors</span></div>}
      </section>
      <section className="pf-admin-single pf-admin-user-list">
        <div className="pf-admin-list">
          <div className="pf-admin-panel-heading">
            <div>
              <p className="pf-admin-eyebrow">Account directory</p>
              <h2>Users <span>{filteredUsers.length}</span></h2>
            </div>
            <div className="pf-admin-user-filters">
              <input type="search" className="pf-admin-filter" placeholder="Search users..." value={searchTerm} onChange={event => setSearchTerm(event.target.value)} />
              <select className="pf-admin-filter" value={roleFilter} onChange={event => setRoleFilter(event.target.value)}>
                <option value="">All roles</option><option value="student">Students</option><option value="recruiter">Recruiters</option><option value="admin">Admins</option>
              </select>
              <select className="pf-admin-filter" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
                <option value="">All statuses</option><option value="active">Active</option><option value="blocked">Blocked</option>
              </select>
            </div>
          </div>
          {loading ? <Empty text="Loading users..." /> : filteredUsers.length === 0 ? <Empty text="No users match this search." /> : filteredUsers.map(user => (
            <article className={`pf-admin-list-item${user.blocked ? ' is-blocked' : ''}`} key={user.id}>
              <div className="pf-admin-user-row">
                {user.avatarUrl ? <img className="pf-admin-user-avatar" src={user.avatarUrl} alt="" /> : <span className="pf-admin-user-avatar pf-admin-user-avatar--fallback"><UserRound size={16} /></span>}
                <div>
                  <div className="pf-admin-user-badges">
                    <span className={`pf-admin-status-badge is-${user.role === 'admin' ? 'published' : 'draft'}`}>{user.role}</span>
                    {user.blocked && <span className="pf-admin-status-badge is-blocked">blocked</span>}
                  </div>
                  <h3>{user.fullName}</h3>
                  <p>{user.email}{user.rollNumber ? ` · Roll ${user.rollNumber}` : ''}{user.department ? ` · ${user.department}` : ''}</p>
                </div>
              </div>
              <div className="pf-admin-item-actions">
                <Button variant="ghost" size="sm" icon={Eye} onClick={() => setViewingUser(user)}>Details</Button>
                {user.role !== 'admin' && (
                  <>
                    <Button variant="ghost" size="sm" disabled={saving} onClick={() => promoteUser(user)}>{user.role === 'recruiter' ? 'Make student' : 'Make recruiter'}</Button>
                    <Button variant={user.blocked ? 'outline' : 'ghost'} size="sm" icon={user.blocked ? CheckCircle2 : Ban} onClick={() => setConfirmingBlock(user)}>{user.blocked ? 'Unblock' : 'Block'}</Button>
                    <button className="pf-admin-icon-button pf-admin-icon-button--danger" title="Delete user" onClick={() => setConfirmingDelete(user)}><Trash2 size={16} /></button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <Modal isOpen={!!viewingUser} onClose={() => setViewingUser(null)} title="User details">
        {viewingUser && (
          <div className="pf-admin-user-details">
            <div className="pf-admin-user-details-head">
              {viewingUser.avatarUrl ? <img className="pf-admin-user-details-avatar" src={viewingUser.avatarUrl} alt="" /> : <span className="pf-admin-user-details-avatar pf-admin-user-details-avatar--fallback"><UserRound size={22} /></span>}
              <div><h3>{viewingUser.fullName}</h3><p className="pf-admin-eyebrow">{viewingUser.role} · joined {viewingUser.createdAt ? new Date(viewingUser.createdAt).toLocaleDateString() : 'recently'}</p></div>
            </div>
            <dl>
              <dt>Email</dt><dd>{viewingUser.email}</dd>
              <dt>Phone</dt><dd>{viewingUser.phone || '—'}</dd>
              <dt>Roll number</dt><dd>{viewingUser.rollNumber || 'Not specified'}</dd>
              <dt>Department</dt><dd>{viewingUser.department || 'Not specified'}</dd>
              <dt>Batch</dt><dd>{viewingUser.batchYear || 'Not specified'}</dd>
              <dt>Achievements</dt><dd>{viewingUser.achievementsCount ?? 0}</dd>
              <dt>Interests</dt><dd>{viewingUser.interestsCount ?? 0}</dd>
              <dt>Status</dt><dd>{viewingUser.blocked ? 'Blocked' : 'Active'} · onboarding {viewingUser.onboarding?.completed ? 'completed' : 'in progress'}</dd>
            </dl>
            {viewingUser.email && <a className="pf-admin-user-mail" href={`mailto:${viewingUser.email}`}><Mail size={15} />Email {viewingUser.fullName.split(' ')[0]}</a>}
          </div>
        )}
      </Modal>

      <Modal isOpen={!!confirmingBlock} onClose={() => setConfirmingBlock(null)} title={confirmingBlock?.blocked ? `Unblock ${confirmingBlock?.fullName}?` : `Block ${confirmingBlock?.fullName}?`}
        footer={<>
          <Button variant="secondary" onClick={() => setConfirmingBlock(null)}>Cancel</Button>
          <Button variant={confirmingBlock?.blocked ? 'primary' : 'danger'} loading={saving} onClick={() => toggleBlock(confirmingBlock)}>{confirmingBlock?.blocked ? 'Unblock user' : 'Block user'}</Button>
        </>}>
        <p>{confirmingBlock?.blocked ? 'They will be able to sign in and use the platform again immediately.' : 'They will be signed out and unable to sign in until unblocked. Their profile and applications are preserved.'}</p>
      </Modal>

      <Modal isOpen={!!confirmingDelete} onClose={() => setConfirmingDelete(null)} title={`Delete ${confirmingDelete?.fullName}?`}
        footer={<>
          <Button variant="secondary" onClick={() => setConfirmingDelete(null)}>Cancel</Button>
          <Button variant="danger" loading={saving} onClick={() => removeUser(confirmingDelete)}>Delete permanently</Button>
        </>}>
        <p>This permanently removes {confirmingDelete?.fullName}'s account, profile, achievements, and applications. This action cannot be undone.</p>
      </Modal>
    </>
  );
}
