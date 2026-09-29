import React from 'react';

/**
 * Modern PDF badge icon matching the stylized stacked-sheet document design.
 */
export function PdfIcon({ size = 26, className = '', color = 'currentColor', ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Background stacked sheet L-bracket */}
      <path
        d="M 6.5 12 V 23.5 C 6.5 24.88 7.62 26 9 26 H 20.5"
        stroke={color}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Foreground card */}
      <rect
        x="10"
        y="6"
        width="17.5"
        height="15.5"
        rx="3.2"
        ry="3.2"
        stroke={color}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      {/* PDF text label */}
      <text
        x="18.75"
        y="16.6"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        fontSize="6.6"
        fontWeight="800"
        letterSpacing="0.4"
        fill={color}
      >
        PDF
      </text>
    </svg>
  );
}

export default PdfIcon;
