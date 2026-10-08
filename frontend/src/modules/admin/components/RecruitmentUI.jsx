import React from 'react';
import { Sparkles, Info } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import './RecruitmentUI.css';

/**
 * Shared presentational pieces for the recruitment intelligence surfaces.
 * Deliberately reuse the Pathfolio design language (tokens, pf- classes,
 * existing Badge/Button) so everything reads as part of the existing app.
 */

export const ENGAGEMENT_STATUS_VARIANTS = {
  proposed: 'amber',
  under_discussion: 'amber',
  accepted: 'success',
  rejected: 'danger',
  reschedule_requested: 'amber',
  confirmed: 'success',
  cancelled: 'danger',
  completed: 'success',
  draft: 'neutral'
};

export const ENGAGEMENT_STATUS_LABELS = {
  proposed: 'Proposed',
  under_discussion: 'Under discussion',
  accepted: 'Accepted',
  rejected: 'Rejected',
  reschedule_requested: 'Reschedule requested',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  completed: 'Completed'
};

export function EngagementStatusBadge({ status, label, size = 'sm' }) {
  const variant = ENGAGEMENT_STATUS_VARIANTS[status] || 'neutral';
  const text = label || ENGAGEMENT_STATUS_LABELS[status] || status;
  return <Badge variant={variant} size={size}>{text}</Badge>;
}

export const RECOMMENDATION_VARIANTS = {
  contact_now: 'success',
  contact_soon: 'success',
  monitor: 'amber',
  low_priority: 'neutral'
};

export function RecommendationBadge({ recommendation, label }) {
  const variant = RECOMMENDATION_VARIANTS[recommendation] || 'neutral';
  const text = label || recommendation.replace(/_/g, ' ');
  return <Badge variant={variant} size="sm">{text}</Badge>;
}

/**
 * Explainable score breakdown: one row per factor, earned/max, and the
 * evidence sentence. Requirement #19 - inspectable evidence, never a black box.
 */
export function ScoreBreakdown({ factors, compact = false }) {
  if (!factors) return null;
  const entries = Object.values(factors);
  return (
    <div className={`pf-rec-score${compact ? ' pf-rec-score--compact' : ''}`}>
      {entries.map(factor => (
        <div className="pf-rec-score__row" key={factor.label}>
          <span className="pf-rec-score__label">{factor.label}</span>
          <span className="pf-rec-score__bar" role="presentation">
            <span className="pf-rec-score__fill" style={{ width: `${Math.round((factor.earned / factor.max) * 100)}%` }} />
          </span>
          <span className="pf-rec-score__value">{factor.earned}/{factor.max}</span>
          {!compact && <span className="pf-rec-score__detail">{factor.detail}</span>}
        </div>
      ))}
    </div>
  );
}

/** Large score chip for company rows. */
export function ScoreChip({ score }) {
  const tone = score >= 70 ? 'high' : score >= 50 ? 'mid' : score >= 30 ? 'low' : 'minimal';
  return (
    <span className={`pf-rec-scorechip pf-rec-scorechip--${tone}`}>
      <b>{score}</b><i>/100</i>
    </span>
  );
}

/**
 * Mandatory AI disclosure label. Every AI-generated surface renders this so
 * outputs are never mistaken for decisions (#9, #10, #25).
 */
export function AiLabel({ children = 'AI-generated analysis - decision support only. The placement team makes the final decision.' }) {
  return (
    <p className="pf-rec-ai-label">
      <Sparkles size={13} /> {children}
    </p>
  );
}

/** Quiet notice used when the AI provider is unavailable. */
export function AiUnavailable({ children = 'AI analysis unavailable - showing data-based results. You can continue manually.' }) {
  return (
    <p className="pf-rec-ai-unavailable">
      <Info size={13} /> {children}
    </p>
  );
}

export function PipelineTracker({ stages, currentStage }) {
  if (!stages?.length) return null;
  const currentIndex = stages.findIndex(stage => stage.id === currentStage);
  return (
    <ol className="pf-rec-pipeline">
      {stages.map((stage, index) => (
        <li key={stage.id} className={index < currentIndex ? 'is-done' : index === currentIndex ? 'is-current' : ''}>
          <span className="pf-rec-pipeline__dot" aria-hidden="true" />
          <span className="pf-rec-pipeline__label">{stage.label}</span>
        </li>
      ))}
    </ol>
  );
}

export const formatDate = iso => iso ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso)) : '-';
export const formatDateTime = iso => iso ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '-';
