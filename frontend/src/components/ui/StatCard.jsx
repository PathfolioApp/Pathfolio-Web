import React from 'react';
import './StatCard.css';

/**
 * A compact analytics stat card used across portal overview sections.
 */
export function StatCard({ label, value, hint, icon: Icon }) {
  return (
    <article className="pf-stat-card">
      {Icon && <span className="pf-stat-card__icon"><Icon size={18} /></span>}
      <span className="pf-stat-card__value">{value ?? '—'}</span>
      <span className="pf-stat-card__label">{label}</span>
      {hint && <span className="pf-stat-card__hint">{hint}</span>}
    </article>
  );
}

export function OverviewCards({ cards, columns }) {
  return (
    <section className="pf-overview-cards" style={columns ? { '--stat-columns': columns } : undefined}>
      {cards.map(card => <StatCard key={card.label} {...card} />)}
    </section>
  );
}
