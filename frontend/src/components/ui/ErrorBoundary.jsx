import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Class error boundary: keeps a render crash inside one region of the app
 * instead of unmounting the whole React tree (a thrown error in any component
 * otherwise blanks the page - e.g. ProfilePage crashing on unexpected data).
 *
 * Usage:
 *   <ErrorBoundary>                 -> full-page fallback (router level)
 *   <ErrorBoundary compact>         -> inline card fallback (portal sections)
 *   <ErrorBoundary label="Recruitment"> -> names the failed region in the UI
 *   and in the console group.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Console group keeps the stack readable without polluting the default log.
    console.group(`[Pathfolio] Render error in ${this.props.label || 'component'}`);
    console.error(error);
    if (info?.componentStack) console.error(info.componentStack);
    console.groupEnd();
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.compact) {
      return (
        <div
          role="alert"
          style={{
            border: '1px solid var(--border, #e5e0d8)',
            borderRadius: 12,
            padding: '20px 22px',
            margin: '16px 0',
            backgroundColor: 'var(--card, #fff)',
            color: 'var(--foreground, #1c1b18)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <AlertTriangle size={18} aria-hidden="true" />
            <strong>{this.props.label || 'This section'} could not be displayed</strong>
          </div>
          <p style={{ margin: '0 0 14px', color: 'var(--muted-foreground, #6b675e)', fontSize: '0.92rem' }}>
            Something went wrong while rendering this part of the page. The rest of the app is still usable.
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            style={{
              border: '1px solid var(--border, #e5e0d8)',
              borderRadius: 8,
              padding: '6px 14px',
              cursor: 'pointer',
              backgroundColor: 'transparent',
              color: 'inherit'
            }}
          >
            Try again
          </button>
        </div>
      );
    }

    return (
      <div
        role="alert"
        style={{
          minHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '64px 24px',
          textAlign: 'center',
          color: 'var(--foreground, #1c1b18)'
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--color-primary-light, #f3efe7)',
            color: 'var(--color-primary, #1e3a2f)',
            marginBottom: 24
          }}
        >
          <AlertTriangle size={30} />
        </div>
        <span style={{ letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '0.8rem', color: 'var(--muted-foreground, #6b675e)' }}>
          Something went wrong
        </span>
        <h1 style={{ fontSize: '2rem', margin: '10px 0 12px' }}>
          {this.props.label || 'This page'} hit an unexpected error
        </h1>
        <p style={{ color: 'var(--muted-foreground, #6b675e)', maxWidth: 440, marginBottom: 28 }}>
          Your record is safe. Try opening this page again, or return to your workspace and continue from there.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="button"
            onClick={this.handleReset}
            style={{
              border: '1px solid var(--border, #e5e0d8)',
              borderRadius: 8,
              padding: '10px 18px',
              cursor: 'pointer',
              backgroundColor: 'transparent',
              color: 'inherit'
            }}
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => { window.location.href = '/dashboard'; }}
            style={{
              border: 'none',
              borderRadius: 8,
              padding: '10px 18px',
              cursor: 'pointer',
              backgroundColor: 'var(--color-primary, #1e3a2f)',
              color: '#fff'
            }}
          >
            Go to dashboard
          </button>
        </div>
      </div>
    );
  }
}
