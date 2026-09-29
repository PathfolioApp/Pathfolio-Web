import React from 'react';
import './PageHeader.css';

/**
 * Shared page header: 28-32px serif title on one slim row, optional count
 * badge next to the title, primary action right-aligned on the same row.
 * Replaces the old eyebrow + huge-title headers on every portal page.
 */
export function PageHeader({ title, count, subtitle, action, children }) {
  return (
    <header className="pf-page-header">
      <div className="pf-page-header__titles">
        <div className="pf-page-header__title-row">
          <h1 className="pf-page-header__title">{title}</h1>
          {count !== undefined && count !== null && (
            <span className="pf-page-header__count">{count}</span>
          )}
        </div>
        {subtitle && <p className="pf-page-header__sub">{subtitle}</p>}
      </div>
      {(action || children) && (
        <div className="pf-page-header__actions">
          {children}
          {action}
        </div>
      )}
    </header>
  );
}
