import React from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Check, AlertCircle, X, ArrowRight } from 'lucide-react';
import './AiToast.css';

export default function AiToast({ toast, onClose, isLeaving = false }) {
  if (!toast) return null;

  const { type = 'success', title, message, actionLabel, onAction, actionLink } = toast;

  return createPortal(
    <div
      className={`pf-ai-toast-portal ${isLeaving ? 'is-leaving' : ''}`}
      role="alert"
      aria-live="polite"
    >
      <div className={`pf-ai-toast pf-ai-toast--${type}`}>
        <div className="pf-ai-toast-icon-wrapper">
          {type === 'loading' && (
            <div className="pf-ai-toast-badge pf-ai-toast-badge--loading">
              <Loader2 size={16} className="pf-ai-toast-spin" />
            </div>
          )}
          {type === 'success' && (
            <div className="pf-ai-toast-badge pf-ai-toast-badge--success">
              <Check size={16} strokeWidth={2.4} />
            </div>
          )}
          {type === 'error' && (
            <div className="pf-ai-toast-badge pf-ai-toast-badge--error">
              <AlertCircle size={16} strokeWidth={2.2} />
            </div>
          )}
        </div>

        <div className="pf-ai-toast-body">
          <h4 className="pf-ai-toast-title">{title}</h4>
          {message && <p className="pf-ai-toast-desc">{message}</p>}

          {(actionLabel || actionLink) && (
            <div className="pf-ai-toast-action-row">
              {actionLink ? (
                <a
                  href={actionLink}
                  className="pf-ai-toast-action-btn"
                  onClick={onClose}
                >
                  <span>{actionLabel || 'Open in Studio'}</span>
                  <ArrowRight size={13} />
                </a>
              ) : (
                <button
                  type="button"
                  className="pf-ai-toast-action-btn"
                  onClick={() => {
                    onAction?.();
                    onClose?.();
                  }}
                >
                  <span>{actionLabel}</span>
                  <ArrowRight size={13} />
                </button>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          className="pf-ai-toast-close-btn"
          onClick={onClose}
          aria-label="Dismiss toast"
        >
          <X size={15} />
        </button>

        {toast.duration > 0 && (
          <div
            className="pf-ai-toast-meter"
            style={{ animationDuration: `${toast.duration}ms` }}
          />
        )}
      </div>
    </div>,
    document.body
  );
}
