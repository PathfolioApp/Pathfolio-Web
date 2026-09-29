import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { HOBBY_PROFICIENCY_LEVELS, PASSION_FAMILIARITY_LEVELS } from '../types/config';
import './InterestDetailList.css';

const VARIANTS = {
  hobby: {
    levels: HOBBY_PROFICIENCY_LEVELS,
    skillQuestion: 'How good are you?',
    reasonQuestion: 'Why did you choose it?',
    reasonPlaceholder: 'Optional — e.g. I enjoy documenting places and people.'
  },
  passion: {
    levels: PASSION_FAMILIARITY_LEVELS,
    skillQuestion: 'How familiar are you with this field?',
    reasonQuestion: 'Why does this interest you?',
    reasonPlaceholder: 'Optional — e.g. I want to build systems that learn.'
  }
};

/**
 * Per-selection detail editor for onboarding interests/curiosities.
 * Each selected item can expand to collect a proficiency level (required,
 * defaulted) and an optional reason. Selection chips themselves remain in the
 * TagSelector — this component only manages the extra detail.
 */
export function InterestDetailList({ items = [], onChange, variant = 'hobby', error }) {
  const config = VARIANTS[variant] || VARIANTS.hobby;
  const [expanded, setExpanded] = React.useState(() => new Set());

  const toggleExpand = name => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const updateItem = (name, patch) => {
    onChange(items.map(item => (item.name === name ? { ...item, ...patch } : item)));
  };

  const missingProficiency = items.some(item => !item?.proficiency);

  return (
    <div className="pf-interest-details">
      <span className="pf-interest-details__label">
        A little more about your selections {missingProficiency && <em>(required)</em>}
      </span>
      <div className="pf-interest-details__list">
        {items.map(item => {
          const isOpen = expanded.has(item.name);
          const level = config.levels.find(level => level.value === item.proficiency) || config.levels[0];
          return (
            <div key={item.name} className={`pf-interest-detail ${isOpen ? 'is-open' : ''} ${!item.proficiency ? 'is-incomplete' : ''}`}>
              <button
                type="button"
                className="pf-interest-detail__header"
                onClick={() => toggleExpand(item.name)}
                aria-expanded={isOpen}
              >
                <span className="pf-interest-detail__name">{item.name}</span>
                <span className="pf-interest-detail__meta">
                  {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </span>
              </button>

              {isOpen && (
                <div className="pf-interest-detail__body">
                  <span className="pf-interest-detail__question">{config.skillQuestion}</span>
                  <div className="pf-interest-detail__levels" role="radiogroup" aria-label={`${config.skillQuestion} — ${item.name}`}>
                    {config.levels.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={item.proficiency === option.value}
                        className={`pf-interest-detail__level ${item.proficiency === option.value ? 'is-active' : ''}`}
                        onClick={() => updateItem(item.name, { proficiency: option.value })}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <label className="pf-interest-detail__reason-label" htmlFor={`reason-${variant}-${item.name}`}>
                    {config.reasonQuestion} <small>(optional)</small>
                  </label>
                  <input
                    id={`reason-${variant}-${item.name}`}
                    type="text"
                    className="pf-interest-detail__reason-input"
                    value={item.reason || ''}
                    maxLength={300}
                    onChange={e => updateItem(item.name, { reason: e.target.value })}
                    placeholder={config.reasonPlaceholder}
                  />
                </div>
              )}

              {!isOpen && item.proficiency && (
                <div className="pf-interest-detail__summary">
                  <span className="pf-interest-detail__level-pill">{level.label}</span>
                  {item.reason && <span className="pf-interest-detail__reason-preview">“{item.reason}”</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {error && missingProficiency && <p className="pf-stage-error">{error}</p>}
    </div>
  );
}
