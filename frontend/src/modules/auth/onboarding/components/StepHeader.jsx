import React from 'react';
import './StepHeader.css';

export function StepHeader({ eyebrow, title, description }) {
  return (
    <div className="pf-step-header animate-fade-in">
      {eyebrow && <span className="editorial-eyebrow">{eyebrow}</span>}
      <h2 className="pf-step-header__title">{title}</h2>
      {description && <p className="pf-step-header__desc">{description}</p>}
    </div>
  );
}
