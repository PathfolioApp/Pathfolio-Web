import React, { useState } from 'react';
import { Eye, UserRound, Ban, CheckCircle2, Trash2, Mail, UserPlus } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { AdminModal as Modal } from './AdminDialogs';
import { DataRow, RowMenu } from '../../../components/ui/DataRow';
import { StatusBadge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { adminApi } from '../adminApi';
import { FilePicker, downloadCsvFile, parseCsv } from '../utils/adminHelpers';

const USERS_PAGE_SIZE = 25;

/**
 * Users workspace: compact single-line rows, filters on one row, per-row
 * "..." menu, confirmation dialogs for block/delete, and load-more paging.
 */
export function UserWorkspace({ users, saving, loading, reload, adminId }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [visibleCount, setVisibleCount] = useState(USERS_PAGE_SIZE);
  const [viewingUser, setViewingUser] = useState(null);
  const [viewingDetail, setViewingDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
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
  const visibleUsers = filteredUsers.slice(0, visibleCount);

  const openDetails = async user => {
    setViewingUser(user);
    setViewingDetail(null);
    setDetailError('');
    setDetailLoading(true);
    try {
      const data = await adminApi.userDetail(user.id);
      setViewingDetail(data.user || null);
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setDetailLoading(false);
    }
  };

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

  const promoteUser = user => runAction(async () => {
    await adminApi.setUserRole(user.id, user.role === 'recruiter' ? 'student' : 'recruiter');
    await reload();
  });

  return (
    <>
      {actionError && <div className="pf-admin-error" role="alert">{actionError}</div>}
      {actionMessage && <div className="pf-admin-success" role="status">{actionMessage}</div>}
      <section className="pf-admin-list pf-admin-single">
        <div className="pf-admin-toolbar">
          <input type="search" className="pf-admin-filter pf-admin-filter--grow" placeholder="Search users by name, email, roll number..." value={searchTerm} onChange={event => setSearchTerm(event.target.value)} />
          <select className="pf-admin-filter" value={roleFilter} onChange={event => setRoleFilter(event.target.value)} aria-label="Filter by role">
            <option value="">All roles</option><option value="student">Students</option><option value="recruiter">Recruiters</option><option value="admin">Admins</option>
          </select>
          <select className="pf-admin-filter" value={statusFilter} onChange={event => setStatusFilter(event.target.value)} aria-label="Filter by status">
            <option value="">All statuses</option><option value="active">Active</option><option value="blocked">Blocked</option>
          </select>
        </div>

        {loading ? <EmptyState text="Loading users..." /> : visibleUsers.length === 0 ? (
          <EmptyState icon={UserRound} title="No users found" text="No accounts match this search. Adjust the filters or import users via CSV." />
        ) : visibleUsers.map(user => (
          <DataRow
            key={user.id}
            className={user.blocked ? 'is-blocked' : ''}
            icon={user.avatarUrl
              ? <img className="pf-admin-user-avatar" src={user.avatarUrl} alt="" />
              : <span className="pf-admin-user-avatar pf-admin-user-avatar--fallback"><UserRound size={16} /></span>}
            title={<>
              {user.fullName}
              <StatusBadge status={user.role === 'admin' ? 'published' : 'draft'} label={user.role} />
              {user.blocked && <StatusBadge status="blocked" />}
            </>}
            meta={<>
              {user.email}
              {user.rollNumber ? <span> · Roll {user.rollNumber}</span> : null}
              {user.department ? <span> · {user.department}</span> : null}
            </>}
            aside={
              <RowMenu
                label={`Actions for ${user.fullName}`}
                items={[
                  { label: 'Details', icon: Eye, onSelect: () => openDetails(user) },
                  ...(user.id !== adminId && user.role !== 'admin' ? [
                    { label: user.role === 'recruiter' ? 'Make student' : 'Make recruiter', icon: UserRound, onSelect: () => promoteUser(user), disabled: saving },
                    { label: user.blocked ? 'Unblock' : 'Block', icon: user.blocked ? CheckCircle2 : Ban, onSelect: () => setConfirmingBlock(user), disabled: saving },
                    { label: 'Delete', icon: Trash2, onSelect: () => setConfirmingDelete(user), danger: true, disabled: saving }
                  ] : [])
                ]}
              />
            }
          />
        ))}

        {filteredUsers.length > visibleCount && (
          <div className="pf-admin-load-more">
            <Button variant="secondary" size="sm" onClick={() => setVisibleCount(count => count + USERS_PAGE_SIZE)}>
              Load more ({filteredUsers.length - visibleCount} remaining)
            </Button>
          </div>
        )}
      </section>

      <Modal isOpen={!!viewingUser} onClose={() => setViewingUser(null)} title="User details" maxWidth={720}>
        {viewingUser && (
          <div className="pf-admin-user-details">
            <div className="pf-admin-user-details-head">
              {viewingUser.avatarUrl ? <img className="pf-admin-user-details-avatar" src={viewingUser.avatarUrl} alt="" /> : <span className="pf-admin-user-details-avatar pf-admin-user-details-avatar--fallback"><UserRound size={22} /></span>}
              <div><h3>{viewingUser.fullName}</h3><p className="pf-admin-eyebrow">{viewingUser.role} · joined {viewingUser.createdAt ? new Date(viewingUser.createdAt).toLocaleDateString() : 'recently'}</p></div>
            </div>

            {detailLoading && <p className="pf-admin-help">Loading full record…</p>}
            {detailError && <div className="pf-admin-error" role="alert">{detailError}</div>}

            {viewingDetail && (
              <>
                {viewingDetail.headline && <p className="pf-user-dossier__headline">{viewingDetail.headline}</p>}

                <div className="pf-rec-facts">
                  <div className="pf-rec-fact"><b>{viewingDetail.cgpa ?? '-'}</b><span>CGPA</span></div>
                  <div className="pf-rec-fact"><b>{viewingDetail.applicationsCount}</b><span>applications</span></div>
                  <div className="pf-rec-fact"><b>{viewingDetail.selectedCount}</b><span>selected/offers</span></div>
                  <div className="pf-rec-fact"><b>{viewingDetail.resumeCount}</b><span>resumes{viewingDetail.defaultResume ? ` · default set` : ''}</span></div>
                  <div className="pf-rec-fact"><b>{viewingDetail.recruiterActivity.length}</b><span>recruiter shares</span></div>
                  {viewingDetail.publicProfileEnabled && <div className="pf-rec-fact"><b>{viewingDetail.publicProfileViews}</b><span>public profile views</span></div>}
                </div>

                <dl>
                  <dt>Email</dt><dd>{viewingDetail.email}</dd>
                  <dt>Phone</dt><dd>{viewingDetail.phone || 'Not provided'}</dd>
                  <dt>Roll number</dt><dd>{viewingDetail.rollNumber || 'Not specified'}</dd>
                  <dt>Department</dt><dd>{viewingDetail.department || 'Not specified'}</dd>
                  <dt>Batch</dt><dd>{viewingDetail.batchYear || 'Not specified'}</dd>
                  <dt>CGPA</dt><dd>{viewingDetail.cgpa ?? 'Not on record'}</dd>
                  {viewingDetail.activeBacklogs !== null && <dt>Active backlogs</dt>}
                  {viewingDetail.activeBacklogs !== null && <dd>{viewingDetail.activeBacklogs}</dd>}
                  {viewingDetail.tenthPercentage !== null && <dt>10th score</dt>}
                  {viewingDetail.tenthPercentage !== null && <dd>{viewingDetail.tenthPercentage}%</dd>}
                  {viewingDetail.twelfthPercentage !== null && <dt>12th score</dt>}
                  {viewingDetail.twelfthPercentage !== null && <dd>{viewingDetail.twelfthPercentage}%</dd>}
                  <dt>Resumes</dt><dd>{viewingDetail.resumeCount ? `${viewingDetail.resumeCount} (${viewingDetail.resumeCategories.join(', ') || 'uncategorised'})` : 'None uploaded'}</dd>
                  <dt>Status</dt><dd>{viewingDetail.blocked ? 'Blocked' : 'Active'} · onboarding {viewingDetail.onboardingCompleted ? 'completed' : 'in progress'}</dd>
                  {viewingDetail.social?.linkedin && <dt>LinkedIn</dt>}
                  {viewingDetail.social?.linkedin && <dd><a href={viewingDetail.social.linkedin} target="_blank" rel="noreferrer">{viewingDetail.social.linkedin}</a></dd>}
                </dl>

                {viewingDetail.topSkills.length > 0 && (
                  <div className="pf-user-dossier__section">
                    <p className="pf-rec-why__title">Skills &amp; interests</p>
                    <div className="pf-rec-chiprow">{viewingDetail.topSkills.map((skill, index) => <span key={index}>{skill}</span>)}</div>
                  </div>
                )}

                {viewingDetail.applicationHistory.length > 0 && (
                  <div className="pf-user-dossier__section">
                    <p className="pf-rec-why__title">Placement &amp; application history</p>
                    {viewingDetail.applicationHistory.map(application => (
                      <div className="pf-user-dossier__row" key={application.id}>
                        <div>
                          <b>{application.jobTitle}</b>
                          <span>{application.companyName}{application.companyName ? ' · ' : ''}applied {application.appliedAt ? new Date(application.appliedAt).toLocaleDateString() : '-'}</span>
                        </div>
                        <StatusBadge status={application.status} />
                      </div>
                    ))}
                  </div>
                )}

                {viewingDetail.recruiterActivity.length > 0 && (
                  <div className="pf-user-dossier__section">
                    <p className="pf-rec-why__title">Shared with companies</p>
                    {viewingDetail.recruiterActivity.map(entry => (
                      <div className="pf-user-dossier__row" key={entry.shareId}>
                        <div>
                          <b>{entry.jobTitle || 'Candidate shortlist'}</b>
                          <span>
                            shared {entry.sharedAt ? new Date(entry.sharedAt).toLocaleDateString() : '-'}
                            {entry.viewedAt ? ` · viewed by company ${new Date(entry.viewedAt).toLocaleDateString()}` : ' · not yet viewed'}
                            {entry.feedback ? ` · feedback: ${entry.feedback.status || 'note'}` : ''}
                          </span>
                          {entry.feedback?.note && <span className="pf-user-dossier__note">"{entry.feedback.note}"</span>}
                        </div>
                        <StatusBadge status={entry.status} />
                      </div>
                    ))}
                  </div>
                )}

                {(viewingDetail.recentProjects.length > 0 || viewingDetail.recentInternships.length > 0 || viewingDetail.recentAchievements.length > 0) && (
                  <div className="pf-user-dossier__section">
                    <p className="pf-rec-why__title">Recent portfolio activity</p>
                    {viewingDetail.recentInternships.map((internship, index) => (
                      <div className="pf-user-dossier__row" key={`i-${index}`}>
                        <div><b>{internship.role}</b><span>{internship.company}{internship.currentlyWorking ? ' · ongoing' : ''}</span></div>
                      </div>
                    ))}
                    {viewingDetail.recentProjects.map((project, index) => (
                      <div className="pf-user-dossier__row" key={`p-${index}`}>
                        <div><b>{project.name}</b><span>{project.technologies.join(', ')}</span></div>
                      </div>
                    ))}
                    {viewingDetail.recentAchievements.map((achievement, index) => (
                      <div className="pf-user-dossier__row" key={`a-${index}`}>
                        <div><b>{achievement.title}</b><span>{achievement.category}{achievement.year ? ` · ${achievement.year}` : ''}</span></div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Full record: everything the student entered */}
                {(viewingDetail.semesterRecords?.length > 0 || viewingDetail.documentsOnFile?.tenthMarksheet || viewingDetail.documentsOnFile?.twelfthMarksheet) && (
                  <div className="pf-user-dossier__section">
                    <p className="pf-rec-why__title">Academic record</p>
                    {viewingDetail.documentsOnFile?.tenthMarksheet && <p className="pf-user-dossier__plain">10th marksheet on file</p>}
                    {viewingDetail.documentsOnFile?.twelfthMarksheet && <p className="pf-user-dossier__plain">12th marksheet on file</p>}
                    {viewingDetail.semesterRecords.map(semester => (
                      <div className="pf-user-dossier__row" key={semester.id}>
                        <div><b>Semester {semester.semester}</b><span>{semester.academicYear || 'year not recorded'}</span></div>
                        <span className="pf-user-dossier__score">SGPA {semester.sgpa ?? '-'}{semester.hasTranscript ? ' · transcript' : ''}</span>
                      </div>
                    ))}
                  </div>
                )}

                {(viewingDetail.structuredInterests?.passions?.length > 0 || viewingDetail.structuredInterests?.hobbies?.length > 0) && (
                  <div className="pf-user-dossier__section">
                    <p className="pf-rec-why__title">Interests in detail</p>
                    {['passions', 'hobbies'].map(group => viewingDetail.structuredInterests[group]?.map((interest, index) => (
                      <div className="pf-user-dossier__row" key={`${group}-${index}`}>
                        <div><b>{interest.name}</b>{interest.reason && <span>{interest.reason}</span>}</div>
                        {interest.proficiency && <span className="pf-user-dossier__score">{interest.proficiency}</span>}
                      </div>
                    )))}
                  </div>
                )}

                {viewingDetail.allInternships?.length > 0 && (
                  <div className="pf-user-dossier__section">
                    <p className="pf-rec-why__title">All internships &amp; experience</p>
                    {viewingDetail.allInternships.map(internship => (
                      <div className="pf-user-dossier__row" key={internship.id || internship.role}>
                        <div>
                          <b>{internship.role} at {internship.company}</b>
                          <span>{[internship.location, internship.workMode, internship.startDate, internship.currentlyWorking ? 'ongoing' : internship.endDate].filter(Boolean).join(' · ')}</span>
                          {internship.skills?.length > 0 && <span>{internship.skills.join(', ')}</span>}
                          {internship.description && <span className="pf-user-dossier__note">{internship.description}</span>}
                          {internship.responsibilities?.map((item, index) => <span key={index}>- {item}</span>)}
                          {internship.hasCertificate && <span className="pf-user-dossier__doc">Certificate on file</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {viewingDetail.allProjects?.length > 0 && (
                  <div className="pf-user-dossier__section">
                    <p className="pf-rec-why__title">All projects</p>
                    {viewingDetail.allProjects.map(project => (
                      <div className="pf-user-dossier__row" key={project.id || project.name}>
                        <div>
                          <b>{project.name}{project.featured ? ' ★' : ''}</b>
                          <span>{[project.type, project.startDate, project.currentlyWorking ? 'ongoing' : project.endDate].filter(Boolean).join(' · ')}</span>
                          {project.technologies?.length > 0 && <span>{project.technologies.join(', ')}</span>}
                          {project.description && <span className="pf-user-dossier__note">{project.description}</span>}
                          {project.contributions?.map((item, index) => <span key={index}>- {item}</span>)}
                          <span className="pf-user-dossier__links">
                            {project.projectUrl && <a href={project.projectUrl} target="_blank" rel="noreferrer">live</a>}
                            {project.repoUrl && <a href={project.repoUrl} target="_blank" rel="noreferrer">repo</a>}
                            {project.hasDocument && <span>document on file</span>}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {viewingDetail.allAchievements?.length > 0 && (
                  <div className="pf-user-dossier__section">
                    <p className="pf-rec-why__title">All achievements</p>
                    {viewingDetail.allAchievements.map(achievement => (
                      <div className="pf-user-dossier__row" key={achievement.id || achievement.title}>
                        <div>
                          <b>{achievement.title}</b>
                          <span>{[achievement.category, achievement.year].filter(Boolean).join(' · ')}</span>
                          {achievement.description && <span className="pf-user-dossier__note">{achievement.description}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {viewingDetail.resumeList?.length > 0 && (
                  <div className="pf-user-dossier__section">
                    <p className="pf-rec-why__title">Resume library</p>
                    {viewingDetail.resumeList.map(resume => (
                      <div className="pf-user-dossier__row" key={resume.id}>
                        <div>
                          <b>{resume.filename}{resume.isDefault ? ' · default' : ''}</b>
                          <span>{resume.category}{resume.tags?.length ? ` · ${resume.tags.join(', ')}` : ''} · uploaded {resume.uploadedAt ? new Date(resume.uploadedAt).toLocaleDateString() : '-'}</span>
                        </div>
                        {resume.analysisScore !== null && resume.analysisScore !== undefined && <span className="pf-user-dossier__score">{resume.analysisScore}%</span>}
                      </div>
                    ))}
                  </div>
                )}

                {viewingDetail.familyContext?.recorded && (
                  <div className="pf-user-dossier__section pf-user-dossier__section--sensitive">
                    <p className="pf-rec-why__title">Family context (consent {viewingDetail.familyContext.consentGiven ? 'given' : 'not recorded'})</p>
                    <p className="pf-user-dossier__note">{viewingDetail.familyContext.details}</p>
                  </div>
                )}

                {viewingDetail.social?.links?.length > 0 && (
                  <div className="pf-user-dossier__section">
                    <p className="pf-rec-why__title">Links</p>
                    <div className="pf-user-dossier__links">
                      {viewingDetail.social.linkedin && <a href={viewingDetail.social.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>}
                      {viewingDetail.social.links.map((link, index) => <a key={index} href={link} target="_blank" rel="noreferrer">{link.replace(/^https?:\/\//, '').slice(0, 40)}</a>)}
                    </div>
                  </div>
                )}
              </>
            )}
            {!detailLoading && !viewingDetail && !detailError && (
              <dl>
                <dt>Email</dt><dd>{viewingUser.email}</dd>
                <dt>Phone</dt><dd>{viewingUser.phone || '-'}</dd>
                <dt>Roll number</dt><dd>{viewingUser.rollNumber || 'Not specified'}</dd>
                <dt>Department</dt><dd>{viewingUser.department || 'Not specified'}</dd>
                <dt>Batch</dt><dd>{viewingUser.batchYear || 'Not specified'}</dd>
              </dl>
            )}
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

/** CSV bulk import for users, opened from the page header "Import CSV" button. */
export function UserImportModal({ open, saving, reload, onClose }) {
  const [userImportRows, setUserImportRows] = useState([]);
  const [userImportErrors, setUserImportErrors] = useState([]);
  const [userImportSummary, setUserImportSummary] = useState(null);

  const readUserImport = event => {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsv(String(reader.result || ''));
      const errors = rows.flatMap((row, index) => (!row.fullname || !row.email || !row.password ? [{ row: index + 2, message: 'fullName, email, and password are required.' }] : []));
      setUserImportRows(rows); setUserImportErrors(errors); setUserImportSummary(null);
    };
    reader.readAsText(file);
  };

  const importUsers = async () => {
    if (!userImportRows.length || userImportErrors.length) return;
    try {
      const result = await adminApi.importUsers(userImportRows);
      setUserImportSummary(result.summary); setUserImportRows([]);
      await reload?.();
    } catch { /* errors surface in the summary area */ }
  };

  const downloadTemplate = () => downloadCsvFile(
    'pathfolio-users-template.csv',
    'fullName,email,password,role,department,batchYear,rollNumber\nExample Student,2024CS101@kiit.ac.in,change-me-123,student,Computer Science,2028,2024CS101\nExample Recruiter,recruiter@company.com,change-me-123,recruiter,Recruitment,Operations,\n'
  );

  const close = () => { setUserImportRows([]); setUserImportErrors([]); setUserImportSummary(null); onClose(); };

  return (
    <Modal isOpen={open} onClose={close} title="Bulk add users"
      footer={<>
        <Button variant="ghost" onClick={close} disabled={saving}>Close</Button>
        <Button loading={saving} disabled={userImportRows.length === 0 || userImportErrors.length > 0} icon={UserPlus} onClick={importUsers}>Import {userImportRows.length} users</Button>
      </>}>
      <p className="pf-admin-import-copy">Import student or recruiter accounts in one CSV. Passwords are hashed before storage; users should change temporary passwords after their first sign-in.</p>
      <div className="pf-admin-import-actions">
        <FilePicker accept=".csv,text/csv" onFile={readUserImport}>Choose CSV file</FilePicker>
        <Button variant="secondary" size="sm" onClick={downloadTemplate}>Download template</Button>
      </div>
      {userImportRows.length > 0 && (
        <div className="pf-admin-import-preview">
          <strong>Preview: {userImportRows.length} rows</strong>
          {userImportRows.slice(0, 5).map((row, index) => <span key={index}>{row.fullname} · {row.email} · {row.role || 'student'}</span>)}
        </div>
      )}
      {userImportErrors.length > 0 && <div className="pf-admin-import-errors">{userImportErrors.map((item, index) => <span key={index}>Row {item.row}: {item.message}</span>)}</div>}
      {userImportSummary && <div className="pf-admin-import-summary"><b>Imported {userImportSummary.imported}</b><span>{userImportSummary.errors.length} validation errors</span></div>}
    </Modal>
  );
}
