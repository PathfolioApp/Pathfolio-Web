import React from 'react';
import {
  BadgeCheck,
  Trophy,
  GraduationCap,
  Code2,
  Users,
  HeartHandshake,
  Medal,
  Palette,
  Award,
} from 'lucide-react';
import './AchievementIcon.css';

export const ACHIEVEMENT_CATEGORIES_MAP = {
  certification: {
    icon: BadgeCheck,
    label: 'Certification',
    color: '#16532d',
    bg: '#edf7ee',
    border: '#cfe3d0',
  },
  hackathon: {
    icon: Trophy,
    label: 'Competition / Hackathon',
    color: '#8b5e14',
    bg: '#fbf5e8',
    border: '#ebd6a7',
  },
  academic: {
    icon: GraduationCap,
    label: 'Academic Honor',
    color: '#1a4331',
    bg: '#edf4f0',
    border: '#d0dfd4',
  },
  project: {
    icon: Code2,
    label: 'Personal / Technical Project',
    color: '#1d4872',
    bg: '#eef4fa',
    border: '#cfdff0',
  },
  leadership: {
    icon: Users,
    label: 'Leadership & Club Role',
    color: '#24523b',
    bg: '#edf5f0',
    border: '#d2e4d7',
  },
  volunteering: {
    icon: HeartHandshake,
    label: 'Community Volunteering',
    color: '#8f3244',
    bg: '#fbedf0',
    border: '#ebc5cc',
  },
  sports: {
    icon: Medal,
    label: 'Athletics & Sports',
    color: '#944b1c',
    bg: '#fbf0e8',
    border: '#edd3c1',
  },
  creative: {
    icon: Palette,
    label: 'Creative & Arts Milestone',
    color: '#5e3592',
    bg: '#f4eefb',
    border: '#ded0f3',
  },
  default: {
    icon: Award,
    label: 'Milestone Achievement',
    color: '#1c452c',
    bg: '#edf4ef',
    border: '#d0dfd3',
  },
};

export function getAchievementCategoryConfig(category) {
  if (!category) return ACHIEVEMENT_CATEGORIES_MAP.default;
  const c = String(category).toLowerCase().trim();

  if (c.includes('certif') || c.includes('license') || c.includes('credential')) {
    return ACHIEVEMENT_CATEGORIES_MAP.certification;
  }
  if (c.includes('hackathon') || c.includes('compet') || c.includes('contest') || c.includes('olympiad')) {
    return ACHIEVEMENT_CATEGORIES_MAP.hackathon;
  }
  if (c.includes('academic') || c.includes('honor') || c.includes('dean') || c.includes('scholar') || c.includes('merit') || c.includes('gpa')) {
    return ACHIEVEMENT_CATEGORIES_MAP.academic;
  }
  if (c.includes('project') || c.includes('code') || c.includes('software') || c.includes('app') || c.includes('tech') || c.includes('build')) {
    return ACHIEVEMENT_CATEGORIES_MAP.project;
  }
  if (c.includes('lead') || c.includes('club') || c.includes('presid') || c.includes('head') || c.includes('officer') || c.includes('council')) {
    return ACHIEVEMENT_CATEGORIES_MAP.leadership;
  }
  if (c.includes('volunt') || c.includes('communit') || c.includes('social') || c.includes('ngo') || c.includes('charity') || c.includes('service')) {
    return ACHIEVEMENT_CATEGORIES_MAP.volunteering;
  }
  if (c.includes('sport') || c.includes('athlet') || c.includes('tournam') || c.includes('championship') || c.includes('cricket') || c.includes('football') || c.includes('basketball') || c.includes('badminton') || c.includes('chess') || c.includes('fitness')) {
    return ACHIEVEMENT_CATEGORIES_MAP.sports;
  }
  if (c.includes('art') || c.includes('creat') || c.includes('design') || c.includes('music') || c.includes('write') || c.includes('photo') || c.includes('theat') || c.includes('film')) {
    return ACHIEVEMENT_CATEGORIES_MAP.creative;
  }

  return ACHIEVEMENT_CATEGORIES_MAP.default;
}

/**
 * Sleek category-specific achievement icon component
 *
 * @param {string} category - Category string (e.g. "Certification", "Competition / Hackathon")
 * @param {number} size - Icon size in px (default: 18)
 * @param {'badge' | 'glyph'} variant - 'badge' displays a stylish squircle container, 'glyph' displays just the SVG
 * @param {number} badgeSize - Badge container size in px if variant='badge' (default: 36)
 * @param {string} className - Optional additional CSS class
 */
export function AchievementIcon({
  category = '',
  size = 18,
  variant = 'badge',
  badgeSize = 36,
  className = '',
  ...props
}) {
  const config = getAchievementCategoryConfig(category);
  const IconComponent = config.icon;

  if (variant === 'glyph') {
    return (
      <span
        className={`pf-achievement-icon-glyph ${className}`}
        style={{ '--ach-badge-color': config.color }}
        title={config.label}
        {...props}
      >
        <IconComponent size={size} strokeWidth={1.85} />
      </span>
    );
  }

  return (
    <div
      className={`pf-achievement-icon-badge ${className}`}
      style={{
        '--ach-badge-size': `${badgeSize}px`,
        '--ach-badge-bg': config.bg,
        '--ach-badge-border': config.border,
        '--ach-badge-color': config.color,
      }}
      title={config.label}
      {...props}
    >
      <IconComponent size={size} strokeWidth={1.85} />
    </div>
  );
}
