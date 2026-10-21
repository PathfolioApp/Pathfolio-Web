import React from 'react';
import { CheckCircle2, Send } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';

export const EMPTY_JOB_FORM = {
  companyName: '', title: '', description: '', location: '', employmentType: 'Full-time', workMode: 'On-site',
  applicationUrl: '', salaryMin: '', salaryMax: '', requiredSkills: '',
  minCgpa: '', maxActiveBacklogs: '', allowedDepartments: '', allowedBatches: '', applicationDeadline: '', submit: true
};

/** Modal form for creating/editing a recruiter job post. */
export function JobPostComposer({ open, job, companies, saving, error, onClose, onSubmit }) {
  const [jobForm, setJobForm] = React.useState(EMPTY_JOB_FORM);
  const isEditing = Boolean(job);

  React.useEffect(() => {
    if (!open) return;
    if (job) {
      setJobForm({
        companyName: job.companyName || '', title: job.title, description: job.description, location: job.location,
        employmentType: job.employmentType || 'Full-time', workMode: job.workMode || 'On-site',
        applicationUrl: job.applicationUrl, salaryMin: job.salaryMin ?? '', salaryMax: job.salaryMax ?? '',
        requiredSkills: (job.requiredSkills || []).join(', '),
        minCgpa: job.eligibility?.minCgpa ?? '', maxActiveBacklogs: job.eligibility?.maxActiveBacklogs ?? '',
        allowedDepartments: (job.eligibility?.allowedDepartments || []).join(', '),
        allowedBatches: (job.eligibility?.allowedBatches || []).join(', '),
        applicationDeadline: job.applicationDeadline ? job.applicationDeadline.slice(0, 10) : '', submit: false
      });
    } else {
      setJobForm({ ...EMPTY_JOB_FORM });
    }
  }, [open, job, companies]);

  const update = field => event => {
    const value = event.target.value;
    setJobForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async event => {
    event.preventDefault();
    const payload = {
      ...jobForm,
      publish: undefined,
      requiredSkills: jobForm.requiredSkills.split(',').map(item => item.trim()).filter(Boolean),
      eligibility: {
        minCgpa: jobForm.minCgpa === '' ? null : Number(jobForm.minCgpa),
        maxActiveBacklogs: jobForm.maxActiveBacklogs === '' ? null : Number(jobForm.maxActiveBacklogs),
        allowedDepartments: jobForm.allowedDepartments.split(',').map(item => item.trim()).filter(Boolean),
        allowedBatches: jobForm.allowedBatches.split(',').map(item => item.trim()).filter(Boolean)
      }
    };
    await onSubmit(payload, isEditing);
  };

  return (
    <Modal className="pf-recruiter-overlay" maxWidth="720px" isOpen={open} onClose={() => !saving && onClose()} title={isEditing ? `Edit ${job.title}` : 'Create a job post'}>
      <form className="pf-recruiter-job-form" onSubmit={handleSubmit}>
        {error && <div className="pf-recruiter-error" role="alert">{error}</div>}
        <label>Company *<input required list="recruiter-company-options" value={jobForm.companyName} onChange={update('companyName')} placeholder="e.g. Acme Systems" maxLength={180} />
          <datalist id="recruiter-company-options">
            {companies.map(company => <option key={company.id} value={company.name} />)}
          </datalist>
        </label>
        <label>Job title *<input required value={jobForm.title} onChange={update('title')} placeholder="e.g. Frontend Engineer" /></label>
        <label>Job description *<textarea required rows="5" value={jobForm.description} onChange={update('description')} placeholder="Responsibilities, culture, interview process…" /></label>
        <div className="pf-recruiter-job-grid">
          <label>Location<input value={jobForm.location} onChange={update('location')} placeholder="Bengaluru" /></label>
          <label>Work mode<select value={jobForm.workMode} onChange={update('workMode')}><option>On-site</option><option>Hybrid</option><option>Remote</option></select></label>
          <label>Employment type<select value={jobForm.employmentType} onChange={update('employmentType')}><option>Full-time</option><option>Part-time</option><option>Internship</option><option>Contract</option></select></label>
          <label>Application deadline<input type="date" value={jobForm.applicationDeadline} onChange={update('applicationDeadline')} /></label>
          <label>Salary min (annual)<input type="number" min="0" value={jobForm.salaryMin} onChange={update('salaryMin')} placeholder="600000" /></label>
          <label>Salary max (annual)<input type="number" min="0" value={jobForm.salaryMax} onChange={update('salaryMax')} placeholder="900000" /></label>
        </div>
        <label>Required skills<input value={jobForm.requiredSkills} onChange={update('requiredSkills')} placeholder="React, TypeScript, REST APIs (comma separated)" /></label>
        <fieldset><legend>Eligibility criteria (optional)</legend>
          <div className="pf-recruiter-job-grid">
            <label>Minimum CGPA<input type="number" step="0.01" min="0" max="10" value={jobForm.minCgpa} onChange={update('minCgpa')} placeholder="7.0" /></label>
            <label>Max active backlogs<input type="number" min="0" value={jobForm.maxActiveBacklogs} onChange={update('maxActiveBacklogs')} placeholder="0" /></label>
          </div>
          <label>Allowed departments<input value={jobForm.allowedDepartments} onChange={update('allowedDepartments')} placeholder="Computer Science, Information Technology" /></label>
          <label>Allowed batches<input value={jobForm.allowedBatches} onChange={update('allowedBatches')} placeholder="2024 - 2028" /></label>
        </fieldset>
        <label className="pf-recruiter-job-url">External application URL<input type="url" value={jobForm.applicationUrl} onChange={update('applicationUrl')} placeholder="https://careers.company.com/role" /></label>
        <label className="pf-recruiter-job-publish">
          <input type="checkbox" checked={jobForm.submit} onChange={event => { const checked = event.target.checked; setJobForm(prev => ({ ...prev, submit: checked })); }} />
          {isEditing ? 'Submit for admin approval after saving' : 'Submit for admin approval immediately'}
        </label>
        <p className="pf-recruiter-job-hint" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '-6px' }}>
          Jobs go live once the placement team reviews and publishes them.
        </p>
        <div className="pf-recruiter-job-form-actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" loading={saving} icon={isEditing ? CheckCircle2 : Send}>{isEditing ? 'Save changes' : 'Create job post'}</Button>
        </div>
      </form>
    </Modal>
  );
}
