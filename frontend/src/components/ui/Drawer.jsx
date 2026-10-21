import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import './Drawer.css';

/**
 * Right-side drawer for create/edit forms. Escape closes, body scroll is
 * locked while open, and it becomes full screen on small viewports.
 */
export function Drawer({ isOpen, onClose, title, children, footer, width, className = '' }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <>
      <div className={`pf-drawer-backdrop ${className}`.trim()} onClick={onClose} aria-hidden="true" />
      <aside
        className={`pf-drawer-panel ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Panel'}
        style={width ? { width: `min(${width}px, 92vw)` } : undefined}
      >
        <div className="pf-drawer-header">
          {title && <h2 className="pf-drawer-title">{title}</h2>}
          <button className="pf-drawer-close" onClick={onClose} aria-label="Close panel">
            <X size={18} />
          </button>
        </div>
        <div className="pf-drawer-body">{children}</div>
        {footer && <div className="pf-drawer-footer">{footer}</div>}
      </aside>
    </>,
    document.body
  );
}
