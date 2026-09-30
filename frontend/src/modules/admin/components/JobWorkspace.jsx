import React, { useState } from 'react';
import { Clock, Save, Send, Undo2, Paperclip, X, CheckCircle2, RotateCcw, MessageSquareWarning, Pencil } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Drawer } from '../../../components/ui/Drawer';
import { StatusBadge } from '../../../components/ui/Badge';
import { DataRow } from '../../../components/ui/DataRow';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Input } from '../utils/adminHelpers';
import { EditedBadge } from '../../../components/ui/EditedBadge';



const STATUS_LABELS = {
  draft: 'Draft',
  pending_approval: 'Pending approval',
  approved: 'Approved',
  rejected: 'Changes requested',
  published: 'Published',
  closed: 'Closed',
  archived: 'Archived'
};

/**
 * Job posts workspace: full-width list of posts with a single status badge per
 * row and an actions cluster; the composer lives in a right-side drawer opened
 * from the page header ("New post") or a row's Edit button.
 */
export function JobWorkspace({ companies, jobs, loading, jobFilter, setJobFilter, publish, reviewJob, reopenJob, saving, editJob }) {
  return (
    <div className="pf-admin-list pf-admin-single">
      <div className="pf-admin-toolbar">
        <select
          className="pf-admin-filter pf-app-sort-select"
          style={{ maxWidth: '200px' }}
          value={jobFilter}
          onChange={event => setJobFilter(event.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      {loading ? <EmptyState text="Loading posts..." /> : jobs.length === 0 ? (
        <EmptyState icon={Clock} title="No posts yet" text="Save a draft to begin. Posts go live for students after review and publish." />
      ) : jobs.map(job => {
        const company = (companies || []).find(
          c => c.id === job.companyId || c.name?.toLowerCase() === job.companyName?.toLowerCase()
        );
        const logo = company?.logoUrl ? (
          <img src={company.logoUrl} alt={job.companyName} className="pf-app-job-logo" />
        ) : (
          <div className="pf-app-job-logo-fallback">
            {job.companyName?.slice(0, 2).toUpperCase() || 'CO'}
          </div>
        );

        return (
          <DataRow
            key={job.id}
            icon={logo}
            title={<>
              {job.title}
              <StatusBadge status={job.status} />
            </>}
            meta={<>
              {job.companyName} · {job.location || 'Location flexible'}
              <EditedBadge createdAt={job.createdAt} updatedAt={job.updatedAt} />
            </>}
            aside={
              <div className="pf-admin-item-actions">
                {job.status === 'pending_approval' && (
                  <>
                    <Button variant="primary" size="sm" loading={saving} icon={CheckCircle2} onClick={() => reviewJob(job, 'approve')}>Approve</Button>
                    <Button variant="ghost" size="sm" loading={saving} icon={MessageSquareWarning} onClick={() => reviewJob(job, 'reject')}>Request changes</Button>
                  </>
                )}
                {(job.status === 'approved' || job.status === 'draft') && (
                  <Button variant="primary" size="sm" loading={saving} icon={Send} onClick={() => publish(job)}>Publish</Button>
                )}
                {job.status === 'published' && (
                  <Button variant="secondary" size="sm" loading={saving} icon={Undo2} onClick={() => publish(job)}>Close</Button>
                )}
                {job.status === 'closed' && (
                  <Button variant="ghost" size="sm" loading={saving} icon={RotateCcw} onClick={() => reopenJob(job)}>Reopen</Button>
                )}
                {job.status !== 'archived' && (
                  <Button variant="ghost" size="sm" icon={Pencil} onClick={() => editJob(job)}>Edit</Button>
                )}
              </div>
            }
          >
            {(job.status === 'pending_approval' || job.reviewNote) && (
              <p className="pf-admin-review-note">
                {job.status === 'pending_approval' && 'Submitted by the recruiter, review before publishing to students. '}
                {job.reviewNote && `Last note: “${job.reviewNote}”`}
              </p>
            )}
          </DataRow>
        );
      })}
    </div>
  );
}

/** Create/edit job post form in a right-side drawer (prefills when editing). */
export function JobFormDrawer({ open, saving, editingJob, companies, jobForm, setJobForm, namedAttachments, setNamedAttachments, update, onClose, onSubmit }) {
  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      width={560}
      title={editingJob ? 'Edit post' : 'Create a post'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="pf-admin-job-form" loading={saving} icon={Save}>{editingJob ? 'Save changes' : 'Save draft'}</Button>
        </>
      }
    >
      <form id="pf-admin-job-form" className="pf-admin-form" onSubmit={onSubmit}>
        <Input label="Company" full>
          <input required list="admin-company-options" value={jobForm.companyName || ''} onChange={update(setJobForm, 'companyName')} placeholder="e.g. Acme Systems" maxLength={180} />
          <datalist id="admin-company-options">
            {companies.map(company => <option key={company.id} value={company.name} />)}
          </datalist>
        </Input>
        <Input label="Title" full><input required value={jobForm.title} onChange={update(setJobForm, 'title')} placeholder="e.g. Software Engineer" /></Input>
        <Input label="Location" full><input value={jobForm.location} onChange={update(setJobForm, 'location')} placeholder="Bengaluru / Remote" /></Input>
        <Input label="Employment type" full><select value={jobForm.employmentType} onChange={update(setJobForm, 'employmentType')}><option>Full-time</option><option>Part-time</option><option>Internship</option><option>Contract</option></select></Input>
        <Input label="Description" full><textarea required rows="7" value={jobForm.description} onChange={update(setJobForm, 'description')} placeholder="Write the role, responsibilities, and requirements..." /></Input>
        <Input label="Application URL" full><input type="url" value={jobForm.applicationUrl} onChange={update(setJobForm, 'applicationUrl')} placeholder="https://careers.company.com/role" /></Input>
        <Input label="Attachments" full><AttachmentList namedAttachments={namedAttachments} setNamedAttachments={setNamedAttachments} /></Input>
        <fieldset className="pf-admin-fieldset">
          <legend>Compensation & Deadline</legend>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <Input label="Min CTC (LPA)"><input type="number" step="0.1" value={jobForm.salaryMin || ''} onChange={update(setJobForm, 'salaryMin')} placeholder="e.g. 6.5" /></Input>
            <Input label="Max CTC (LPA)"><input type="number" step="0.1" value={jobForm.salaryMax || ''} onChange={update(setJobForm, 'salaryMax')} placeholder="e.g. 12.0" /></Input>
          </div>
          <Input label="Application Deadline" full>
            <input type="datetime-local" value={jobForm.applicationDeadline || ''} onChange={update(setJobForm, 'applicationDeadline')} />
          </Input>
        </fieldset>

        <fieldset className="pf-admin-fieldset">
          <legend>Academic Eligibility Criteria</legend>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <Input label="Min CGPA"><input type="number" step="0.1" min="0" max="10" value={jobForm.minCgpa || ''} onChange={update(setJobForm, 'minCgpa')} placeholder="e.g. 7.0" /></Input>
            <Input label="Max Active Backlogs"><input type="number" step="1" min="0" value={jobForm.maxActiveBacklogs || ''} onChange={update(setJobForm, 'maxActiveBacklogs')} placeholder="e.g. 0" /></Input>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <Input label="Min 10th %"><input type="number" step="1" min="0" max="100" value={jobForm.minTenthPercentage || ''} onChange={update(setJobForm, 'minTenthPercentage')} placeholder="e.g. 60" /></Input>
            <Input label="Min 12th %"><input type="number" step="1" min="0" max="100" value={jobForm.minTwelfthPercentage || ''} onChange={update(setJobForm, 'minTwelfthPercentage')} placeholder="e.g. 60" /></Input>
          </div>
          <Input label="Allowed Batches" full>
            <input type="text" value={jobForm.allowedBatches || ''} onChange={update(setJobForm, 'allowedBatches')} placeholder="e.g. 2024, 2025" />
            <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Comma separated list of graduating years</small>
          </Input>
          <Input label="Allowed Departments" full>
            <input type="text" value={jobForm.allowedDepartments || ''} onChange={update(setJobForm, 'allowedDepartments')} placeholder="e.g. Computer Science, IT, ECE" />
            <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Comma separated list of branch names</small>
          </Input>
        </fieldset>
      </form>
    </Drawer>
  );
}

function AttachmentList({ namedAttachments, setNamedAttachments }) {
  const makeId = () => `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const addFiles = files => {
    const newItems = [...files].map(f => ({ id: makeId(), name: f.name.replace(/\.[^.]+$/, ''), file: f, url: '', type: f.type || 'application/octet-stream' }));
    setNamedAttachments(prev => [...prev, ...newItems]);
  };
  const rename = (id, name) => setNamedAttachments(prev => prev.map(a => (a.id === id ? { ...a, name } : a)));
  const remove = id => setNamedAttachments(prev => prev.filter(a => a.id !== id));
  const [dragging, setDragging] = useState(false);
  const onDrop = e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files); };
  const onDragOver = e => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  return (
    <div className="pf-admin-attachments">
      {namedAttachments.length > 0 && (
        <ul className="pf-admin-attachment-list">
          {namedAttachments.map(item => (
            <li key={item.id} className="pf-admin-attachment-item">
              <Paperclip size={14} className="pf-admin-attach-icon" />
              <input className="pf-admin-attachment-name" value={item.name} onChange={e => rename(item.id, e.target.value)} placeholder="Attachment name" />
              {item.url && !item.file && <a href={item.url} target="_blank" rel="noreferrer" className="pf-admin-attach-link">View</a>}
              <button type="button" className="pf-admin-icon-button" aria-label="Remove attachment" onClick={() => remove(item.id)}><X size={14} /></button>
            </li>
          ))}
        </ul>
      )}
      <label className={`pf-admin-attach-drop${dragging ? ' is-dragging' : ''}`} onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}>
        <Paperclip size={16} />
        <span>{dragging ? 'Drop files here' : 'Drag & drop or click to add files'}</span>
        <input type="file" multiple accept="image/*,.pdf,.doc,.docx" onChange={e => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }} />
      </label>
      <small className="pf-admin-help">Files upload to Cloudinary when you save the draft. Click a name to rename it.</small>
    </div>
  );
}
