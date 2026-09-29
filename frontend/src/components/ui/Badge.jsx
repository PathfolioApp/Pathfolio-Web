import React from 'react';
import './Badge.css';

export function Badge({ children, variant = 'neutral', size = 'md', className = '' }) {
  return (
    <span className={`pf-badge pf-badge--${variant} pf-badge--${size} ${className}`}>
      {children}
    </span>
  );
}
