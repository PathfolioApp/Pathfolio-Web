import React from 'react';
import { Globe, Link2, ExternalLink } from 'lucide-react';

export const PRESET_PLATFORMS = [
  {
    id: 'linkedin',
    name: 'LinkedIn',
    domain: 'linkedin.com',
    placeholder: 'https://linkedin.com/in/username',
    color: '#0a66c2',
    bg: '#edf4fb',
    border: '#bcdcf6',
  },
  {
    id: 'github',
    name: 'GitHub',
    domain: 'github.com',
    placeholder: 'https://github.com/username',
    color: '#1f2328',
    bg: '#f3f4f6',
    border: '#d1d5db',
  },
  {
    id: 'leetcode',
    name: 'LeetCode',
    domain: 'leetcode.com',
    placeholder: 'https://leetcode.com/u/username',
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a',
  },
  {
    id: 'codeforces',
    name: 'Codeforces',
    domain: 'codeforces.com',
    placeholder: 'https://codeforces.com/profile/handle',
    color: '#1d4ed8',
    bg: '#eff6ff',
    border: '#bfdbfe',
  },
  {
    id: 'portfolio',
    name: 'Portfolio / Website',
    domain: '',
    placeholder: 'https://yourportfolio.dev',
    color: '#15803d',
    bg: '#f0fdf4',
    border: '#bbf7d0',
  },
  {
    id: 'kaggle',
    name: 'Kaggle',
    domain: 'kaggle.com',
    placeholder: 'https://kaggle.com/username',
    color: '#0284c7',
    bg: '#f0f9ff',
    border: '#bae6fd',
  },
  {
    id: 'hackerrank',
    name: 'HackerRank',
    domain: 'hackerrank.com',
    placeholder: 'https://hackerrank.com/profile/username',
    color: '#059669',
    bg: '#ecfdf5',
    border: '#a7f3d0',
  },
  {
    id: 'x',
    name: 'X (Twitter)',
    domain: 'x.com',
    placeholder: 'https://x.com/username',
    color: '#0f172a',
    bg: '#f8fafc',
    border: '#cbd5e1',
  },
  {
    id: 'other',
    name: 'Other',
    domain: '',
    placeholder: 'https://...',
    color: '#475569',
    bg: '#f8fafc',
    border: '#cbd5e1',
  }
];

export function getSocialPlatform(platformId) {
  const normalized = String(platformId || 'other').trim().toLowerCase();
  return PRESET_PLATFORMS.find(p => p.id === normalized) || PRESET_PLATFORMS[PRESET_PLATFORMS.length - 1];
}

export function formatSocialUrl(url) {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function displaySocialHandle(url, platformId) {
  if (!url) return '';
  try {
    let clean = url.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '');
    clean = clean.replace(/\/+$/, '');
    return clean;
  } catch {
    return url;
  }
}

export function SocialIcon({ platform, size = 16, className = '' }) {
  const id = String(platform || '').trim().toLowerCase();

  switch (id) {
    case 'linkedin':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="#0a66c2" className={className} aria-label="LinkedIn">
          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
        </svg>
      );
    case 'github':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="#1f2328" className={className} aria-label="GitHub">
          <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/>
        </svg>
      );
    case 'leetcode':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="#d97706" className={className} aria-label="LeetCode">
          <path d="M16.102 17.93l-2.697 2.607c-.466.467-1.111.762-1.823.762s-1.357-.295-1.824-.762l-4.755-4.756a2.58 2.58 0 0 1 0-3.648l4.755-4.755c.467-.467 1.112-.762 1.824-.762.712 0 1.357.295 1.823.762l2.697 2.607a1.05 1.05 0 1 1-1.464 1.503l-2.697-2.607a.473.473 0 0 0-.359-.165c-.139 0-.27.058-.36.165l-4.755 4.755a.474.474 0 0 0 0 .67l4.755 4.756c.09.106.221.164.36.164.138 0 .269-.058.359-.164l2.697-2.608a1.05 1.05 0 1 1 1.464 1.503zM10.825 12h10.125a1.05 1.05 0 0 1 0 2.1H10.825a1.05 1.05 0 0 1 0-2.1z"/>
        </svg>
      );
    case 'codeforces':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-label="Codeforces">
          <rect x="2" y="10" width="5" height="11" rx="1.5" fill="#f59e0b" />
          <rect x="9.5" y="3" width="5" height="18" rx="1.5" fill="#2563eb" />
          <rect x="17" y="7" width="5" height="14" rx="1.5" fill="#dc2626" />
        </svg>
      );
    case 'portfolio':
      return <Globe size={size} color="#15803d" className={className} />;
    case 'kaggle':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="#0284c7" className={className} aria-label="Kaggle">
          <path d="M18.825 21h-3.48l-5.07-6.24L7.545 17.2V21H4V3h3.545v10.53l6.57-7.53h3.48l-6.87 7.74L18.825 21z"/>
        </svg>
      );
    case 'hackerrank':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="#059669" className={className} aria-label="HackerRank">
          <path d="M12 0l9 5.2v13.6L12 24l-9-5.2V5.2L12 0zm-2.4 7.2v9.6h1.8v-3.9h1.2v3.9h1.8V7.2h-1.8v3.9h-1.2V7.2H9.6z"/>
        </svg>
      );
    case 'x':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="#0f172a" className={className} aria-label="X">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      );
    default:
      return <Link2 size={size} color="#64748b" className={className} />;
  }
}
