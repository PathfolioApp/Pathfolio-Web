import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, Save, RotateCcw, Plus, Trash2,
  CheckCircle2, XCircle, AlertTriangle, Sparkles, Layers, FileCheck2
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { adminApi } from '../adminApi';
import { recruitmentApi } from '../recruitmentApi';
import './PlacementPolicyWorkspace.css';

const DEFAULT_POLICY = {
  enabled: true,
  minCtcMultiplier: 1.5,
  maxOffersAllowed: 2,
  brackets: [
    { id: 'tier_1', name: 'Tier 1 (Base)', minLpa: 0, maxLpa: 7 },
    { id: 'tier_2', name: 'Tier 2 (Dream)', minLpa: 7, maxLpa: 14 },
    { id: 'tier_3', name: 'Tier 3 (Super Dream)', minLpa: 14, maxLpa: null }
  ]
};

export function PlacementPolicyWorkspace() {
  const [policy, setPolicy] = useState(DEFAULT_POLICY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Simulator state
  const [simPlacedCtc, setSimPlacedCtc] = useState('6.0');
  const [simTargetCtc, setSimTargetCtc] = useState('10.0');

  // Recruitment policy (resume selection + company access defaults), loaded
  // from the same placement_policy record so ONE page governs everything.
  const RESUME_MODES = [
    ['student_controlled', 'A · Student controlled', 'The student chooses which of their resumes is submitted.'],
    ['university_controlled', 'B · University controlled', 'The placement team selects/approves the resume for every share.'],
    ['ai_university', 'C · AI recommended + approval', 'AI ranks resumes against the role; the placement team approves.']
  ];
  const ACCESS_LEVELS = [
    ['summary', 'Candidate summary only'],
    ['profile', 'Student profile'],
    ['resume', 'Profile + resume'],
    ['full', 'Full candidate information']
  ];
  const [resumeMode, setResumeMode] = useState('university_controlled');
  const [accessLevel, setAccessLevel] = useState('profile');
  const [recruitmentSaving, setRecruitmentSaving] = useState(false);
  const [recruitmentMsg, setRecruitmentMsg] = useState('');

  useEffect(() => {
    loadPolicy();
    recruitmentApi.settings()
      .then(data => {
        setResumeMode(data.settings?.resumePolicyMode || 'university_controlled');
        setAccessLevel(data.settings?.defaultAccessLevel || 'profile');
      })
      .catch(() => {});
  }, []);

  const saveRecruitmentPolicy = async () => {
    setRecruitmentSaving(true); setRecruitmentMsg('');
    try {
      const data = await recruitmentApi.updateSettings({ resumePolicyMode: resumeMode, defaultAccessLevel: accessLevel });
      setResumeMode(data.settings.resumePolicyMode);
      setAccessLevel(data.settings.defaultAccessLevel);
      setRecruitmentMsg('Recruitment policy saved.');
      setTimeout(() => setRecruitmentMsg(''), 4000);
    } catch (err) {
      setRecruitmentMsg(err.message || 'Failed to save recruitment policy.');
    } finally {
      setRecruitmentSaving(false);
    }
  };

  const loadPolicy = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getPlacementPolicy();
      if (data && data.policy) {
        setPolicy({
          enabled: !!data.policy.enabled,
          minCtcMultiplier: Number(data.policy.minCtcMultiplier) || 1.5,
          maxOffersAllowed: Number(data.policy.maxOffersAllowed) || 2,
          brackets: Array.isArray(data.policy.brackets) && data.policy.brackets.length > 0
            ? data.policy.brackets
            : DEFAULT_POLICY.brackets
        });
      }
    } catch (err) {
      console.error('Failed to load placement policy:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ text: '', type: '' });
    try {
      await adminApi.updatePlacementPolicy(policy);
      setMessage({ text: 'Placement policy saved and updated live for all job applications!', type: 'success' });
      setTimeout(() => setMessage({ text: '', type: '' }), 4000);
    } catch (err) {
      setMessage({ text: err.message || 'Failed to save policy.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (window.confirm('Reset placement policy to standard college defaults (< 7 LPA, 7–14 LPA, 14+ LPA, 1.5x Multiplier)?')) {
      setPolicy(DEFAULT_POLICY);
    }
  };

  const handleBracketChange = (index, field, value) => {
    setPolicy(prev => {
      const updated = [...prev.brackets];
      const val = field === 'name' ? value : (value === '' ? null : Number(value));
      updated[index] = { ...updated[index], [field]: val };
      return { ...prev, brackets: updated };
    });
  };

  const addBracket = () => {
    setPolicy(prev => {
      const last = prev.brackets[prev.brackets.length - 1];
      const nextMin = last && last.maxLpa !== null ? last.maxLpa : 20;
      const newBracket = {
        id: `tier_${Date.now()}`,
        name: `Tier ${prev.brackets.length + 1}`,
        minLpa: nextMin,
        maxLpa: null
      };
      return { ...prev, brackets: [...prev.brackets, newBracket] };
    });
  };

  const removeBracket = index => {
    if (policy.brackets.length <= 1) {
      alert('At least one salary tier bracket must be defined.');
      return;
    }
    setPolicy(prev => ({
      ...prev,
      brackets: prev.brackets.filter((_, i) => i !== index)
    }));
  };

  // Live simulation evaluator based on current in-form policy
  const evaluateSimulation = () => {
    if (!policy.enabled) {
      return {
        eligible: true,
        reason: 'Policy enforcement is currently disabled. All students can apply regardless of placed CTC.'
      };
    }

    const placed = parseFloat(simPlacedCtc);
    const target = parseFloat(simTargetCtc);

    if (isNaN(placed) || isNaN(target)) {
      return { eligible: null, reason: 'Enter valid numeric CTC values to test.' };
    }

    // Determine placed bracket
    const findBracket = lpa => policy.brackets.find(b => {
      const min = b.minLpa ?? 0;
      const max = b.maxLpa ?? Infinity;
      return lpa >= min && (b.maxLpa === null ? true : lpa < max);
    });

    const currentBracket = findBracket(placed);
    const targetBracket = findBracket(target);

    // Rule 1: Cannot apply in same or lower tier
    if (currentBracket && targetBracket) {
      const currentIndex = policy.brackets.indexOf(currentBracket);
      const targetIndex = policy.brackets.indexOf(targetBracket);

      if (targetIndex <= currentIndex) {
        return {
          eligible: false,
          reason: `Student is already placed in "${currentBracket.name}" (${placed} LPA). Cannot apply to the same or lower bracket "${targetBracket.name}".`
        };
      }
    }

    // Rule 2: Multiplier check
    const multiplier = policy.minCtcMultiplier || 1.5;
    const requiredCtc = Number((placed * multiplier).toFixed(2));
    if (target < requiredCtc) {
      return {
        eligible: false,
        reason: `Target CTC (${target} LPA) is below the required ${multiplier}x jump threshold (${requiredCtc} LPA) based on the current ${placed} LPA offer.`
      };
    }

    return {
      eligible: true,
      reason: `Eligible! The ${target} LPA role is in a higher tier ("${targetBracket?.name || 'Higher Tier'}") and satisfies the ${multiplier}x jump threshold (requires >= ${requiredCtc} LPA).`
    };
  };

  const simResult = evaluateSimulation();

  if (loading) {
    return <div className="pf-admin-single"><p style={{ padding: '2rem', textAlign: 'center' }}>Loading placement policy...</p></div>;
  }

  return (
    <div className="pf-admin-single pf-policy-workspace">
      {/* Header */}
      <div className="pf-policy-header">
        <div className="pf-policy-title-area">
          <h2>Placement Upgrade & Tier Jumping Policy</h2>
          <p>Enforce fair placement drive rules, prevent offer hoarding, and define salary upgrade criteria.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Button variant="ghost" onClick={handleReset} icon={RotateCcw}>Reset Defaults</Button>
          <Button variant="primary" onClick={handleSave} loading={saving} icon={Save}>Save Policy</Button>
        </div>
      </div>

      {message.text && (
        <div className={message.type === 'success' ? 'pf-admin-success' : 'pf-admin-error'}>
          {message.text}
        </div>
      )}

      {/* Master Toggle */}
      <div className="pf-policy-card">
        <div className="pf-policy-toggle-row">
          <div className="pf-policy-toggle-info">
            <span className="pf-policy-toggle-title">Enforce Placement Upgrade Policy</span>
            <span className="pf-policy-toggle-desc">
              When enabled, students who already hold a confirmed offer (&apos;placed&apos; or &apos;selected&apos;) are restricted by salary brackets and multiplier rules.
            </span>
          </div>
          <label className="pf-switch" aria-label="Toggle policy enforcement">
            <input
              type="checkbox"
              checked={policy.enabled}
              onChange={e => setPolicy(prev => ({ ...prev, enabled: e.target.checked }))}
            />
            <span className="pf-slider"></span>
          </label>
        </div>
      </div>

      {/* Policy Parameters */}
      <div className="pf-policy-card">
        <h3 className="pf-policy-card-title">
          <ShieldCheck size={18} /> Global Upgrade Rules
        </h3>
        <div className="pf-policy-params-grid">
          <div className="pf-policy-field">
            <label htmlFor="ctc-multiplier">Minimum CTC Jump Multiplier (x Current Offer)</label>
            <input
              id="ctc-multiplier"
              type="number"
              step="0.1"
              min="1.0"
              max="5.0"
              value={policy.minCtcMultiplier}
              onChange={e => setPolicy(prev => ({ ...prev, minCtcMultiplier: parseFloat(e.target.value) || 1.0 }))}
            />
            <small>Default is 1.5x (e.g. a 6 LPA placed student needs at least 9.0 LPA to apply).</small>
          </div>

          <div className="pf-policy-field">
            <label htmlFor="max-offers">Maximum Offers Allowed per Student</label>
            <input
              id="max-offers"
              type="number"
              step="1"
              min="1"
              max="10"
              value={policy.maxOffersAllowed}
              onChange={e => setPolicy(prev => ({ ...prev, maxOffersAllowed: parseInt(e.target.value, 10) || 1 }))}
            />
            <small>Once a student accepts this many offers (e.g. 2), all further job applications are locked.</small>
          </div>
        </div>
      </div>

      {/* Brackets Editor */}
      <div className="pf-policy-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="pf-policy-card-title">
            <Layers size={18} /> Placement Salary Brackets (LPA)
          </h3>
          <Button variant="secondary" size="sm" onClick={addBracket} icon={Plus}>Add Tier</Button>
        </div>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Students placed in a tier cannot apply for another job in the same tier. They can only apply to higher tiers if the CTC also satisfies the {policy.minCtcMultiplier}x multiplier rule.
        </p>

        <div className="pf-brackets-list">
          {policy.brackets.map((bracket, index) => (
            <div key={bracket.id || index} className="pf-bracket-row">
              <div className="pf-bracket-input-group">
                <label>Tier Name</label>
                <input
                  type="text"
                  value={bracket.name}
                  onChange={e => handleBracketChange(index, 'name', e.target.value)}
                  placeholder="e.g. Tier 1 (Base)"
                />
              </div>

              <div className="pf-bracket-input-group">
                <label>Min LPA (inclusive)</label>
                <input
                  type="number"
                  step="0.5"
                  value={bracket.minLpa ?? ''}
                  onChange={e => handleBracketChange(index, 'minLpa', e.target.value)}
                  placeholder="0"
                />
              </div>

              <div className="pf-bracket-input-group">
                <label>Max LPA (exclusive, blank = ∞)</label>
                <input
                  type="number"
                  step="0.5"
                  value={bracket.maxLpa ?? ''}
                  onChange={e => handleBracketChange(index, 'maxLpa', e.target.value)}
                  placeholder="No limit"
                />
              </div>

              <div style={{ alignSelf: 'flex-end', paddingBottom: '2px' }}>
                <button
                  type="button"
                  className="pf-admin-icon-button"
                  aria-label="Remove tier"
                  onClick={() => removeBracket(index)}
                  title="Remove tier"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recruitment Policy (resume selection + company access) */}
      <div className="pf-policy-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h3 className="pf-policy-card-title">
            <FileCheck2 size={18} /> Recruitment Policy - Resume Selection &amp; Company Access
          </h3>
          <Button variant="primary" size="sm" onClick={saveRecruitmentPolicy} loading={recruitmentSaving} icon={Save}>Save</Button>
        </div>
        <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Governs how candidate resumes are chosen when sharing students with companies, and what companies are allowed to see. Applies to new shares; existing shares keep the policy they were created under.
        </p>
        {recruitmentMsg && (
          <div className={recruitmentMsg.includes('Failed') ? 'pf-admin-error' : 'pf-admin-success'} style={{ marginBottom: 10 }}>{recruitmentMsg}</div>
        )}

        <div className="pf-rec-mode-grid">
          {RESUME_MODES.map(([id, title, text]) => (
            <label key={id} className={`pf-rec-mode-card ${resumeMode === id ? 'is-selected' : ''}`}>
              <input type="radio" name="resumePolicyMode" value={id} checked={resumeMode === id} onChange={() => setResumeMode(id)} />
              <b>{title}</b>
              <span>{text}</span>
            </label>
          ))}
        </div>

        <div className="pf-policy-field" style={{ marginTop: 14, maxWidth: 360 }}>
          <label htmlFor="default-access">Default company access level</label>
          <select
            id="default-access"
            className="pf-policy-select"
            value={accessLevel}
            onChange={e => setAccessLevel(e.target.value)}
            style={{ width: '100%', minHeight: 40, border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', padding: '0 10px', background: 'var(--bg-surface)', color: 'var(--text-primary)', font: 'inherit' }}
          >
            {ACCESS_LEVELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <small>Companies only ever see the level the placement team permits; every resume access is logged and revocable per share.</small>
        </div>
      </div>

      {/* Interactive Simulator */}
      <div className="pf-policy-card">
        <h3 className="pf-policy-card-title">
          <Sparkles size={18} /> Live Policy Simulator & Verification
        </h3>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Test whether a student with an existing placement offer would be allowed to apply for a new campus job under your current policy.
        </p>

        <div className="pf-sim-box">
          <div className="pf-sim-inputs">
            <div className="pf-policy-field">
              <label>Existing Confirmed Offer CTC (LPA)</label>
              <input
                type="number"
                step="0.5"
                value={simPlacedCtc}
                onChange={e => setSimPlacedCtc(e.target.value)}
                placeholder="6.0"
              />
            </div>
            <div className="pf-policy-field">
              <label>Target Job Opportunity CTC (LPA)</label>
              <input
                type="number"
                step="0.5"
                value={simTargetCtc}
                onChange={e => setSimTargetCtc(e.target.value)}
                placeholder="10.0"
              />
            </div>
          </div>

          {simResult.eligible !== null && (
            <div className={`pf-sim-result ${simResult.eligible ? 'eligible' : 'ineligible'}`}>
              {simResult.eligible ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
              <div>
                <strong>{simResult.eligible ? 'Application Allowed' : 'Application Blocked'}</strong>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.84rem' }}>{simResult.reason}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
