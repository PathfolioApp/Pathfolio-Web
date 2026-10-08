import React, { useEffect, useRef, useState } from 'react';
import './TabFade.css';

/**
 * Soft cross-fade for tab-level content swaps. Mounts children keyed by
 * `tabKey`; on change the old tree fades out briefly and the new one fades
 * in, using the house transition timing. Falls back to an instant swap if
 * the browser prefers reduced motion.
 */
export function TabFade({ tabKey, children, className = '' }) {
  const [stage, setStage] = useState('in'); // 'out' | 'in'
  const [renderKey, setRenderKey] = useState(tabKey);
  const [rendered, setRendered] = useState(children);
  const pending = useRef(null);

  useEffect(() => {
    if (tabKey === renderKey) return;
    pending.current = { tabKey, children };
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setRenderKey(tabKey);
      setRendered(children);
      setStage('in');
      pending.current = null;
      return;
    }
    setStage('out');
    const timer = setTimeout(() => {
      const next = pending.current;
      pending.current = null;
      if (next) {
        setRenderKey(next.tabKey);
        setRendered(next.children);
      }
      setStage('in');
    }, 140);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabKey]);

  // Always render the freshest children for the CURRENT key (data refreshes
  // inside a tab should not replay the fade).
  useEffect(() => {
    if (stage === 'in' && tabKey === renderKey) setRendered(children);
  }, [children, stage, tabKey, renderKey]);

  return (
    <div className={`pf-tab-fade pf-tab-fade--${stage} ${className}`} key={renderKey}>
      {rendered}
    </div>
  );
}
