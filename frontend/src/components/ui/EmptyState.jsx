import React from 'react';
import './EmptyState.css';

/**
 * Shared empty state: centered icon, one line of copy, and an optional
 * helpful action button - replaces lone paragraphs in boxes.
 */
export function EmptyState({ icon: Icon, title, text, action, className = '' }) {
  return (
    <div className={`pf-empty-state ${className}`}>
      {Icon && (
        <span className="pf-empty-state__icon"><Icon size={20} /></span>
      )}
      {title && <h3 className="pf-empty-state__title">{title}</h3>}
      {text && <p className="pf-empty-state__text">{text}</p>}
      {action && <div className="pf-empty-state__action">{action}</div>}
    </div>
  );
}
