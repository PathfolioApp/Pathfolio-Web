import React from 'react';
import './Button.css';

export function Button({
  children,
  variant = 'primary', // 'primary', 'secondary', 'ghost', 'outline', 'danger'
  size = 'md',        // 'sm', 'md', 'lg'
  type = 'button',
  disabled = false,
  loading = false,
  icon: Icon = null,
  iconPosition = 'left',
  onClick,
  className = '',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`pf-btn pf-btn--${variant} pf-btn--${size} ${loading ? 'is-loading' : ''} ${className}`}
      {...props}
    >
      {loading && <span className="pf-btn__spinner" aria-hidden="true" />}
      {!loading && Icon && iconPosition === 'left' && <Icon className="pf-btn__icon" size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} />}
      <span className="pf-btn__text">{children}</span>
      {!loading && Icon && iconPosition === 'right' && <Icon className="pf-btn__icon" size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} />}
    </button>
  );
}
