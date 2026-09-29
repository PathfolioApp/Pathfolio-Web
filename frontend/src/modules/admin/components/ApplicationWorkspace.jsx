import React, { useState } from 'react';
import { Calendar, Eye, Filter, Download, BriefcaseBusiness } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { DataRow } from '../../../components/ui/DataRow';
import { StatusBadge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Empty, formatISTDate } from '../utils/adminHelpers';

const STATUS_OPTIONS = ['applied', 'shortlisted', 'interview', 'selected', 'rejected'];

export function ApplicationWorkspace({ jobs, applicationJobFilter, setApplicationJobFilter, applications, loading, updateApplication, saving }) {
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [fieldFilters, setFieldFilters] = useState({});
  const [viewingAppId, setViewingAppId] = useState(null);
  const [applicationFilter, setApplicationFilter] = useState('');

  const selectedJob = jobs.find(j => j.id === applicationJobFilter);
  const jobFields = selectedJob?.applicationForm?.fields || [];

  const handleFilterChange = (id, value) => setFieldFilters(prev => ({ ...prev, [id]: value }));

  const getFilteredApplications = base => {
    let filtered = base;
    Object.entries(fieldFilters).forEach(([fieldId, filterValue]) => {
      if (!filterValue) return;
      const lowerFilter = filterValue.toLowerCase();
      filtered = filtered.filter(app => {
        const val = app.answers?.[fieldId];
        if (val === undefined || val === null) return false;
        if (!isNaN(parseFloat(filterValue)) && !isNaN(parseFloat(val))) return parseFloat(val) >= parseFloat(filterValue);
        return String(val).toLowerCase().includes(lowerFilter);
      });
    });
    return filtered;
  };

  const exportCsv = () => {
    const filteredApps = getFilteredApplications(jobApplications.filter(app => !applicationFilter || app.status === applicationFilter));
    if (filteredApps.length === 0) { alert('No applications match the filter criteria.'); return; }
    const allKeys = new Set();
    filteredApps.forEach(app => { if (app.answers) Object.keys(app.answers).forEach(k => allKeys.add(k)); });
    const escapeCsv = val => `"${String(val || '').replace(/"/g, '""')}"`;
    const header = ['Name', 'Email', 'Status', 'Applied At', ...Array.from(allKeys)].map(escapeCsv);
    const rows = filteredApps.map(app => {
      const base = [app.profileSnapshot.fullName || '', app.profileSnapshot.email || '', app.status, new Date(app.createdAt).toISOString()];
      const extras = Array.from(allKeys).map(k => app.answers?.[k] || '');
      return [...base, ...extras].map(escapeCsv).join(',');
    });
    const csvContent = [header.join(','), ...rows].join('\n');
    const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', 'applications_export.csv');
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setFilterModalOpen(false);
  };

  if (!applicationJobFilter) {
    return (
      <section className="pf-admin-single">
        <div className="pf-admin-list">
          {jobs.length === 0 ? (
            <EmptyState icon={BriefcaseBusiness} title="No posts available" text="Create a job post first; applications will be grouped per post here." />
          ) : jobs.map(job => (
            <DataRow
              key={job.id}
              onClick={() => setApplicationJobFilter(job.id)}
              title={<>
                {job.title}
                <StatusBadge status={job.status} />
              </>}
              meta={job.companyName}
              aside={<span className="pf-admin-app-count">{applications.filter(app => app.jobPostId === job.id).length} applications</span>}
            />
          ))}
        </div>
      </section>
    );
  }

  const viewingApp = applications.find(a => a.id === viewingAppId);
  const jobApplications = applications.filter(app => app.jobPostId === applicationJobFilter);
  const statusFiltered = jobApplications.filter(app => !applicationFilter || app.status === applicationFilter);
  const displayApplications = getFilteredApplications(statusFiltered);

  return (
    <section className="pf-admin-single">
      <div className="pf-admin-list">
        <div className="pf-admin-toolbar pf-admin-toolbar--wrap">
          <Button variant="ghost" size="sm" onClick={() => setApplicationJobFilter('')}>&larr; All job posts</Button>
          <select className="pf-admin-filter" value={applicationFilter} onChange={event => setApplicationFilter(event.target.value)} aria-label="Filter by status">
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map(status => <option key={status} value={status}>{status}</option>)}
          </select>
          <Button type="button" onClick={() => setFilterModalOpen(true)} size="sm" variant="secondary" icon={Filter}>
            Filters {Object.values(fieldFilters).some(v => v) ? '(Active)' : ''}
          </Button>
          <Button type="button" onClick={exportCsv} size="sm" variant="primary" icon={Download}>Export CSV</Button>
        </div>

        {loading ? <Empty text="Loading applications..." /> : displayApplications.length === 0 ? (
          <EmptyState icon={BriefcaseBusiness} title="No applications" text="No applications match the current filters." />
        ) : displayApplications.map(application => (
          <DataRow
            key={application.id}
            title={<>
              {application.profileSnapshot.fullName || 'Student applicant'}
              <StatusBadge status={application.status === 'applied' ? 'draft' : application.status} label={application.status} />
            </>}
            meta={<>
              {application.profileSnapshot.email}
              {application.profileSnapshot.department && <span> · {application.profileSnapshot.department}</span>}
              {application.profileSnapshot.batchYear && <span> · {application.profileSnapshot.batchYear}</span>}
              <span className="pf-data-row__meta-date"><Calendar size={12} /> {formatISTDate(application.createdAt)} IST</span>
            </>}
            aside={
              <div className="pf-admin-item-actions">
                {application.answers && Object.keys(application.answers).length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setViewingAppId(application.id)} icon={Eye}>View Info</Button>
                )}
                <select value={application.status} disabled={saving} onClick={event => event.stopPropagation()} onChange={event => updateApplication(application.id, event.target.value)} aria-label="Application status">
                  {STATUS_OPTIONS.map(status => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
            }
          />
        ))}
      </div>

      <Modal isOpen={!!viewingAppId} onClose={() => setViewingAppId(null)} title="Application Details">
        {viewingApp && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ borderBottom: '1px solid #eaeaea', paddingBottom: '1rem' }}>
              <h3 style={{ margin: '0 0 0.5rem' }}>{viewingApp.profileSnapshot.fullName}</h3>
              <p style={{ margin: 0, color: '#557550' }}>
                {viewingApp.profileSnapshot.email}
                {viewingApp.profileSnapshot.phone ? ` · ${viewingApp.profileSnapshot.phone}` : ''}
              </p>
            </div>
            <div>
              <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 1rem' }}>Submitted Information</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {Object.entries(viewingApp.answers || {}).map(([k, v]) => (
                  <div key={k}>
                    <strong style={{ display: 'block', fontSize: '0.9rem' }}>{k}</strong>
                    {v.startsWith('http') ? <a href={v} target="_blank" rel="noreferrer" style={{ color: '#557550' }}>{v}</a> : <span>{v}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={filterModalOpen} onClose={() => setFilterModalOpen(false)} title="Filter Applications"
        footer={<div style={{ display: 'flex', gap: '1rem', width: '100%', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={() => { setFieldFilters({}); setFilterModalOpen(false); }}>Clear Filters</Button>
          <Button variant="primary" onClick={() => setFilterModalOpen(false)}>Apply Filters</Button>
        </div>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '60vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#557550' }}>Filter applications by collected fields. The current filtered view will be used when exporting.</p>
          {jobFields.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>No custom fields were collected for this job.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
              {jobFields.map(field => (
                <label key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>
                  {field.label} {field.id.toLowerCase().includes('cgpa') && '(Min)'}
                  <input type="text" placeholder={`Filter by ${field.label.toLowerCase()}...`} value={fieldFilters[field.id] || ''} onChange={e => handleFilterChange(field.id, e.target.value)} style={{ padding: '0.6rem 0.75rem', border: '1px solid #cbd4ca', borderRadius: '4px', fontSize: '0.9rem' }} />
                </label>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </section>
  );
}
