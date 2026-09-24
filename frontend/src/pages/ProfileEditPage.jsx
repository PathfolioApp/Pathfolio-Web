import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Award, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { profileApi } from '../services/profileApi';
import { Modal } from '../components/Modal';
import { ACHIEVEMENT_CATEGORIES } from '../features/onboarding/types/config';
import './ProfilePages.css';
import './ProfileEditEnhancements.css';
import './AchievementModal.css';

const split = value => value.split(',').map(item => item.trim()).filter(Boolean);
const cleanDescription = value => String(value || '').replace(/\*\*(.*?)\*\*/g, '$1');

export function ProfileEditPage() {
  const { student, refresh } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [savingSection, setSavingSection] = useState('');
  const [personal, setPersonal] = useState(student.personal);
  const [academic, setAcademic] = useState({ degreeProgram: 'B.Tech', graduationYear: 2027, ...student.academic });
  const [interests, setInterests] = useState(student.interests);
  const [family, setFamily] = useState(student.familyContext || { details: '', consentGiven: false });
  const [newAchievement, setNewAchievement] = useState({ title: '', category: ACHIEVEMENT_CATEGORIES[0], customCategory: '', description: '', year: '' });
  const [editingAchievement, setEditingAchievement] = useState(null);
  const [isAddAchievementOpen, setIsAddAchievementOpen] = useState(false);
  const [toastLeaving, setToastLeaving] = useState(false);

  const save = async (section, data) => {
    setError('');
    setMessage('');
    setSavingSection(section);
    try {
      await profileApi.update(section, data);
      await refresh();
      setMessage('Saved. Your profile is up to date.');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSavingSection('');
    }
  };

  const add = async () => {
    setError('');
    setMessage('');
    setSavingSection('achievements');
    try {
      const category = newAchievement.category === 'Other' ? (newAchievement.customCategory.trim() || 'Other') : newAchievement.category;
      await profileApi.addAchievement({ ...newAchievement, category });
      setNewAchievement({ title: '', category: ACHIEVEMENT_CATEGORIES[0], customCategory: '', description: '', year: '' });
      setIsAddAchievementOpen(false);
      await refresh();
      setMessage('Achievement added.');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSavingSection('');
    }
  };

  const editAchievement = async () => {
    setError('');
    setMessage('');
    setSavingSection('achievement-edit');
    try {
      await profileApi.editAchievement(editingAchievement.id, editingAchievement);
      setEditingAchievement(null);
      await refresh();
      setMessage('Achievement updated.');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSavingSection('');
    }
  };

  const removeAchievement = async id => {
    if (!window.confirm('Remove this achievement?')) return;
    try {
      await profileApi.deleteAchievement(id);
      await refresh();
      setMessage('Achievement removed.');
    } catch (saveError) {
      setError(saveError.message);
    }
  };

  const updateAcademic = (field, value) => setAcademic(previous => ({ ...previous, [field]: value }));

  useEffect(() => {
    if (!location.hash) return undefined;
    const targetId = decodeURIComponent(location.hash.slice(1));
    const scrollToTarget = () => document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const frame = window.requestAnimationFrame(scrollToTarget);
    const retry = window.setTimeout(scrollToTarget, 150);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(retry);
    };
  }, [location.hash]);

  useEffect(() => {
    if (!message && !error) return undefined;
    setToastLeaving(false);
    const hideAnimation = window.setTimeout(() => setToastLeaving(true), 3200);
    const removeToast = window.setTimeout(() => {
      setMessage('');
      setError('');
      setToastLeaving(false);
    }, 3600);
    return () => {
      window.clearTimeout(hideAnimation);
      window.clearTimeout(removeToast);
    };
  }, [message, error]);

  return <div className="pf-profile-page">
    <div className="pf-edit-heading">
      <div><p className="editorial-eyebrow">Edit profile</p><h1>Keep your record current.</h1><p>Update one section at a time. Your other information stays untouched.</p></div>
      <button className="pf-secondary pf-back-button" onClick={() => navigate('/profile')}><ArrowLeft size={16} /> Back</button>
    </div>
    {createPortal(<div className={`pf-edit-toast-region${toastLeaving ? ' pf-edit-toast-region--leaving' : ''}`} aria-live="polite">{message && <div className="pf-edit-toast" role="status">{message}</div>}{error && <div className="pf-edit-toast pf-edit-toast--error" role="alert">{error}</div>}</div>, document.body)}

    <EditSection title="Personal information" note="Your email is linked to your institutional identity and can't be changed here." onSave={() => save('personal', personal)} saving={savingSection === 'personal'}>
      <label>Full name<input value={personal.fullName} onChange={event => setPersonal({ ...personal, fullName: event.target.value })} /></label>
      <label>Age<input type="number" value={personal.age} onChange={event => setPersonal({ ...personal, age: event.target.value })} /></label>
      <label>Username<input value={personal.username} onChange={event => setPersonal({ ...personal, username: event.target.value.toLowerCase() })} /></label>
      <label>Institutional email<input value={personal.email} disabled /></label>
    </EditSection>

    <EditSection title="Academic eligibility" note="These fields help TNP determine eligibility for placement opportunities. Leave fields blank until you have verified information." onSave={() => save('academic', academic)} saving={savingSection === 'academic'}>
      <label>Degree / program<input placeholder="B.Tech" value={academic.degreeProgram || ''} onChange={event => updateAcademic('degreeProgram', event.target.value)} /></label>
      <label>Graduation year<input type="number" min="2027" placeholder="2027" value={academic.graduationYear || ''} onChange={event => updateAcademic('graduationYear', event.target.value)} /></label>
      <label>Current semester<input type="number" min="1" max="20" value={academic.currentSemester || ''} onChange={event => updateAcademic('currentSemester', event.target.value)} /></label>
      <label>CGPA<input type="number" min="0" max="10" step="0.01" value={academic.cgpa ?? ''} onChange={event => updateAcademic('cgpa', event.target.value)} /></label>
      <label>10th percentage<input type="number" min="0" max="100" step="0.01" value={academic.tenthPercentage ?? ''} onChange={event => updateAcademic('tenthPercentage', event.target.value)} /></label>
      <label>12th percentage<input type="number" min="0" max="100" step="0.01" value={academic.twelfthPercentage ?? ''} onChange={event => updateAcademic('twelfthPercentage', event.target.value)} /></label>
      <label>Active backlogs<input type="number" min="0" max="100" value={academic.activeBacklogs ?? ''} onChange={event => updateAcademic('activeBacklogs', event.target.value)} /></label>
      <label>Historical backlogs<input type="number" min="0" max="100" value={academic.historicalBacklogs ?? ''} onChange={event => updateAcademic('historicalBacklogs', event.target.value)} /></label>
      <label>Gap years<input type="number" min="0" max="20" step="0.5" value={academic.gapYears ?? ''} onChange={event => updateAcademic('gapYears', event.target.value)} /></label>
      <label>Department<input value={academic.department} onChange={event => updateAcademic('department', event.target.value)} /></label>
      <label>Batch year<input value={academic.batchYear} onChange={event => updateAcademic('batchYear', event.target.value)} /></label>
      <label>Roll number<input value={academic.rollNumber} disabled /></label>
    </EditSection>

    <EditSection id="interests" title="Hobbies & passions" note="Use commas to add or remove tags. Custom interests are welcome." onSave={() => save('interests', interests)} saving={savingSection === 'interests'}>
      <label>Hobbies<input value={interests.hobbies.join(', ')} onChange={event => setInterests({ ...interests, hobbies: split(event.target.value) })} /></label>
      <label>Passions / interests<input value={interests.passions.join(', ')} onChange={event => setInterests({ ...interests, passions: split(event.target.value) })} /></label>
    </EditSection>

    <EditSection id="achievements" title="Achievements" note="Your certifications, hackathons, projects, and milestones." headerAction={<button type="button" className="pf-achievement-add-button" onClick={() => setIsAddAchievementOpen(true)}><Award size={16} /> Add achievement</button>}>
      <div className="pf-achievement-editor-list">{student.achievements.map(achievement => editingAchievement?.id === achievement.id ? <div className="pf-achievement-editor" key={achievement.id}><div className="pf-edit-fields"><label>Title<input value={editingAchievement.title} onChange={event => setEditingAchievement({ ...editingAchievement, title: event.target.value })} /></label><label>Type / category<input value={editingAchievement.category} onChange={event => setEditingAchievement({ ...editingAchievement, category: event.target.value })} /></label><label>Completion year<input type="number" value={editingAchievement.year || ''} onChange={event => setEditingAchievement({ ...editingAchievement, year: event.target.value })} /></label><label>Description<textarea value={editingAchievement.description || ''} onChange={event => setEditingAchievement({ ...editingAchievement, description: event.target.value })} /></label></div><div className="pf-achievement-editor__actions"><button type="button" disabled={savingSection === 'achievement-edit'} onClick={editAchievement}>{savingSection === 'achievement-edit' ? 'Saving...' : 'Save edit'}</button><button type="button" disabled={savingSection === 'achievement-edit'} onClick={() => setEditingAchievement(null)}>Cancel</button></div></div> : <article className="pf-achievement-editor" key={achievement.id}><div className="pf-achievement-editor__icon"><Award size={19} /></div><div className="pf-achievement-editor__body"><div className="pf-achievement-editor__header"><div><strong>{achievement.title}</strong><span className="pf-achievement-editor__meta"><span className="pf-achievement-editor__category">{achievement.category || 'General'}</span>{achievement.year ? `Completed ${achievement.year}` : 'Year not added'}</span></div><div className="pf-achievement-editor__actions"><button type="button" onClick={() => setEditingAchievement({ ...achievement })}>Edit</button><button type="button" onClick={() => removeAchievement(achievement.id)}>Remove</button></div></div>{achievement.description && <p className="pf-achievement-editor__description">{cleanDescription(achievement.description)}</p>}</div></article>)}</div>
    </EditSection>

    <Modal isOpen={isAddAchievementOpen} onClose={() => setIsAddAchievementOpen(false)} title="Add an achievement" footer={<><button type="button" className="pf-secondary" onClick={() => setIsAddAchievementOpen(false)}>Cancel</button><button type="button" className="pf-save" disabled={savingSection === 'achievements'} onClick={add}>{savingSection === 'achievements' ? 'Adding...' : 'Save achievement'}</button></>}>
      <p className="pf-achievement-modal-intro">Capture a milestone with enough detail to help TNP understand its value.</p>
      <div className="pf-achievement-modal-form"><label>Title<input autoFocus value={newAchievement.title} onChange={event => setNewAchievement({ ...newAchievement, title: event.target.value })} placeholder="AWS certification or hackathon rank" /></label><label>Type / category<select value={newAchievement.category} onChange={event => setNewAchievement({ ...newAchievement, category: event.target.value, customCategory: '' })}>{ACHIEVEMENT_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}<option value="Other">Other</option></select></label>{newAchievement.category === 'Other' && <label>Custom category<input value={newAchievement.customCategory} onChange={event => setNewAchievement({ ...newAchievement, customCategory: event.target.value })} placeholder="Write a category" /></label>}<label>Completion year<input type="number" value={newAchievement.year} onChange={event => setNewAchievement({ ...newAchievement, year: event.target.value })} placeholder="2026" /></label><label className="pf-achievement-modal-form__description">Description<textarea value={newAchievement.description} onChange={event => setNewAchievement({ ...newAchievement, description: event.target.value })} placeholder="What did you achieve, build, or learn?" /></label></div>
    </Modal>

    <EditSection title="Personal / family context" note="Optional sensitive information. It is saved only with your explicit consent." onSave={() => save('family-context', family)} saving={savingSection === 'family-context'}>
      <label>Context<textarea value={family.details} onChange={event => setFamily({ ...family, details: event.target.value })} /></label>
      <label className="pf-check"><input type="checkbox" checked={family.consentGiven} onChange={event => setFamily({ ...family, consentGiven: event.target.checked })} /> I consent to storing this sensitive context.</label>
    </EditSection>
  </div>;
}

function EditSection({ id, title, note, onSave, saveLabel = 'Save changes', saving = false, headerAction, children }) {
  return <section id={id} className="pf-edit-section pf-edit-section--target"><div className="pf-edit-section__heading"><h2>{title}</h2>{headerAction}</div><p>{note}</p><div className="pf-edit-fields">{children}</div>{onSave && <button className="pf-save" disabled={saving} onClick={onSave}>{saving ? 'Saving...' : saveLabel}</button>}</section>;
}