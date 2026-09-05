import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';
import './Modal.css';

export function Modal({ isOpen, onClose, title, children, footer }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
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

  return (
    <div className="pf-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="pf-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="pf-modal-header">
          {title && <h3 className="pf-modal-title">{title}</h3>}
          <button className="pf-modal-close" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>
        <div className="pf-modal-body">
          {children}
        </div>
        {footer && <div className="pf-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
