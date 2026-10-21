import React from 'react';
import './Button.css';

// One button system: primary (filled green), secondary (outlined), ghost
// (text/icon), danger (destructive). Legacy names map onto the system so no
// call site has to change at once.
const VARIANT_ALIASES = {
  outline: 'secondary',
  destructive: 'danger'
};

export function Button({
  children,
  buttonRef,
  variant = 'primary',
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
  const resolvedVariant = VARIANT_ALIASES[variant] || variant;
  return (
    <button
      ref={buttonRef}
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`pf-btn pf-btn--${resolvedVariant} pf-btn--${size} ${loading ? 'is-loading' : ''} ${className}`}
      {...props}
    >
      {loading && <span className="pf-btn__spinner" aria-hidden="true" />}
      {!loading && Icon && iconPosition === 'left' && <Icon className="pf-btn__icon" size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} />}
      <span className="pf-btn__text">{children}</span>
      {!loading && Icon && iconPosition === 'right' && <Icon className="pf-btn__icon" size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} />}
    </button>
  );
}
