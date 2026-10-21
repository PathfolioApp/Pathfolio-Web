import React, { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import './DataRow.css';

/**
 * A single divider row used across list pages: title (+optional badges),
 * muted meta line, and right-aligned aside content (actions, badges).
 * With `onClick`/`as="button"` the whole row is clickable.
 */
export function DataRow({ title, meta, aside, icon, onClick, interactiveChildren = false, className = '', children }) {
  // Rows containing their own action buttons must not become nested <button>s.
  const Tag = onClick && !interactiveChildren ? 'button' : 'article';
  const extraProps = onClick
    ? { ...(interactiveChildren ? { role: 'group', tabIndex: 0, onKeyDown: event => {
      if (event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) { event.preventDefault(); onClick(event); }
    } } : { type: 'button' }), onClick, style: { width: '100%', textAlign: 'left', font: 'inherit', background: 'none', border: 0 } }
    : {};
  return (
    <Tag className={`pf-data-row ${onClick ? 'pf-data-row--clickable' : ''} ${className}`} {...extraProps}>
      {icon}
      <div className="pf-data-row__main">
        {title && <h3 className="pf-data-row__title">{title}</h3>}
        {meta && <p className="pf-data-row__meta">{meta}</p>}
        {children}
      </div>
      {aside && <div className="pf-data-row__aside">{aside}</div>}
    </Tag>
  );
}

/**
 * "..." overflow menu for per-row actions (Details / Block / Delete, …).
 * Items: { label, icon, onSelect, danger, disabled }.
 */
export function RowMenu({ items, label = 'Row actions' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!items?.length) return null;

  return (
    <div className="pf-row-menu" ref={rootRef}>
      <button
        type="button"
        className="pf-row-menu__trigger"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen(prev => !prev)}
      >
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <ul className="pf-row-menu__list" role="menu">
          {items.map(item => (
            <li key={item.label} role="none">
              <button
                type="button"
                role="menuitem"
                className={`pf-row-menu__item ${item.danger ? 'pf-row-menu__item--danger' : ''}`}
                disabled={item.disabled}
                onClick={() => { setOpen(false); item.onSelect(); }}
              >
                {item.icon && <item.icon size={15} />}
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
