import React, { useState } from 'react';
import { Clock, Save, Send, Undo2, Paperclip, X, CheckCircle2, RotateCcw, MessageSquareWarning } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input, PanelHeading, Empty, formatISTDate } from '../utils/adminHelpers';

const formOptions = [['rollNumber', 'Roll number'], ['department', 'Department'], ['batchYear', 'Batch year'], ['resumeUrl', 'Resume link'], ['portfolioUrl', 'Portfolio link'], ['skills', 'Skills'], ['cgpa', 'CGPA']];

const STATUS_LABELS = {
  draft: 'Draft',
  pending_approval: 'Pending approval',
  approved: 'Approved',
  rejected: 'Changes requested',
  published: 'Published',
  closed: 'Closed',
  archived: 'Archived'
};

export function JobWorkspace({ companies, jobs, jobForm, setJobForm, editingJob, resetJob, saveJob, loading, editJob, jobFilter, setJobFilter, publish, reviewJob, reopenJob, saving, selectedFields, setSelectedFields, namedAttachments, setNamedAttachments, update }) {
  return (
    <section className="pf-admin-workspace">
      <div className="pf-admin-panel">
        <PanelHeading eyebrow="Opportunity composer" title={editingJob ? 'Edit draft' : 'Create a post'} action={editingJob && <Button variant="ghost" size="sm" onClick={resetJob}>Cancel</Button>} />
        <form className="pf-admin-form" onSubmit={saveJob}>
          <Input label="Company">
            <input required list="admin-company-options" value={jobForm.companyName || ''} onChange={update(setJobForm, 'companyName')} placeholder="e.g. Acme Systems" maxLength={180} />
            <datalist id="admin-company-options">
              {companies.map(company => <option key={company.id} value={company.name} />)}
            </datalist>
          </Input>
          <Input label="Title"><input required value={jobForm.title} onChange={update(setJobForm, 'title')} placeholder="e.g. Software Engineer" /></Input>
          <Input label="Location"><input value={jobForm.location} onChange={update(setJobForm, 'location')} placeholder="Bengaluru / Remote" /></Input>
          <Input label="Employment type"><select value={jobForm.employmentType} onChange={update(setJobForm, 'employmentType')}><option>Full-time</option><option>Part-time</option><option>Internship</option><option>Contract</option></select></Input>
          <Input label="Description" full><textarea required rows="7" value={jobForm.description} onChange={update(setJobForm, 'description')} placeholder="Write the role, responsibilities, and requirements..." /></Input>
          <Input label="Application URL" full><input type="url" value={jobForm.applicationUrl} onChange={update(setJobForm, 'applicationUrl')} placeholder="https://..." /></Input>
          <Input label="Attachments" full><AttachmentList namedAttachments={namedAttachments} setNamedAttachments={setNamedAttachments} /></Input>
          <fieldset className="pf-admin-fieldset">
            <legend>Collect with application</legend>
            {formOptions.map(([id, label]) => (
              <label key={id}>
                <input type="checkbox" checked={selectedFields.includes(id)} onChange={() => setSelectedFields(fields => fields.includes(id) ? fields.filter(field => field !== id) : [...fields, id])} />
                {label}
              </label>
            ))}
          </fieldset>
          <Button type="submit" loading={saving} icon={Save}>Save draft</Button>
        </form>
      </div>
      <div className="pf-admin-list">
        <div className="pf-admin-panel-heading">
          <div><p className="pf-admin-eyebrow">Published content</p><h2>Posts <span>{jobs.length}</span></h2></div>
          <select className="pf-admin-filter" value={jobFilter} onChange={event => setJobFilter(event.target.value)}>
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        {loading ? <Empty text="Loading posts..." /> : jobs.length === 0 ? <Empty text="No posts yet. Save a draft to begin." /> : jobs.map((job, idx) => (
          <article className="pf-admin-list-item" key={job.id}>
            <div>
              <span className={`pf-admin-status-badge is-${job.status === 'published' ? 'published' : job.status === 'pending_approval' ? 'draft' : 'draft'}`}>#{jobs.length - idx} {STATUS_LABELS[job.status] || job.status}</span>
              <h3>{job.title}</h3>
              <p>{job.companyName} · {job.location || 'Location flexible'} <span className="pf-admin-date"><Clock size={12} /> {formatISTDate(job.updatedAt)} IST</span></p>
              {job.status === 'pending_approval' && (
                <p className="pf-admin-review-note">Submitted by the recruiter, review before publishing to students.</p>
              )}
              {job.reviewNote && (
                <p className="pf-admin-review-note">Last note: “{job.reviewNote}”</p>
              )}
            </div>
            <div className="pf-admin-item-actions">
              {job.status === 'pending_approval' && (
                <>
                  <Button variant="primary" size="sm" loading={saving} icon={CheckCircle2} onClick={() => reviewJob(job, 'approve')}>Approve</Button>
                  <Button variant="ghost" size="sm" loading={saving} icon={MessageSquareWarning} onClick={() => reviewJob(job, 'reject')}>Request changes</Button>
                </>
              )}
              {job.status === 'approved' && (
                <Button variant="primary" size="sm" loading={saving} icon={Send} onClick={() => publish(job)}>Publish to students</Button>
              )}
              {job.status === 'published' && (
                <Button variant="outline" size="sm" loading={saving} icon={Undo2} onClick={() => publish(job)}>Close</Button>
              )}
              {job.status === 'closed' && (
                <Button variant="ghost" size="sm" loading={saving} icon={RotateCcw} onClick={() => reopenJob(job)}>Reopen</Button>
              )}
              {job.status !== 'archived' && (
                <Button variant="ghost" size="sm" onClick={() => editJob(job)} disabled={job.status === 'published'}>Edit</Button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
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
              <button type="button" className="pf-admin-icon-button" onClick={() => remove(item.id)}><X size={14} /></button>
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
