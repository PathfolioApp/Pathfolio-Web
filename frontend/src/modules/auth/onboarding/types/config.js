/**
 * Step definitions and metadata for the onboarding journey.
 * The institutional email is collected FIRST; the roll number is derived from
 * it and shown locked in the following step.
 */

export const ONBOARDING_STAGES = [
  {
    id: 'welcome',
    stageNumber: 1,
    title: "Let's begin with you",
    eyebrow: 'Step 1 of 12 • Introduction',
    description: 'Your college journey starts with a few things that make you who you are.',
    isSkippable: false
  },
  {
    id: 'email',
    stageNumber: 2,
    title: 'What is your institutional email?',
    eyebrow: 'Step 2 of 12 • Identity',
    description: 'Use your college email, it follows the format rollnumber@kiit.ac.in, and your roll number is taken straight from it.',
    isSkippable: false
  },
  {
    id: 'identity',
    stageNumber: 3,
    title: 'And your name?',
    eyebrow: 'Step 3 of 12 • About you',
    description: 'Your roll number comes from your email and is locked. Tell us the name to attach to it.',
    isSkippable: false
  },
  {
    id: 'dob',
    stageNumber: 4,
    title: 'When were you born?',
    eyebrow: 'Step 4 of 12 • Demographics',
    description: 'We use your date of birth to understand where you are in your academic journey.',
    isSkippable: false
  },
  {
    id: 'academic',
    stageNumber: 5,
    title: 'Tell us about your college journey.',
    eyebrow: 'Step 5 of 12 • Academic Context',
    description: 'This helps us understand your program, discipline, and graduation cohort.',
    isSkippable: false
  },
  {
    id: 'password',
    stageNumber: 6,
    title: 'Create your password.',
    eyebrow: 'Step 6 of 12 • Account security',
    description: 'Choose a password to keep your Pathfolio account secure.',
    isSkippable: false
  },
  {
    id: 'hobbies',
    stageNumber: 7,
    title: 'What do you enjoy outside the classroom?',
    eyebrow: 'Step 7 of 12 • Personal Interests',
    description: 'Select a few things you love doing in your free time, then tell us how good you are at each.',
    isSkippable: false
  },
  {
    id: 'passions',
    stageNumber: 8,
    title: 'What are you curious about?',
    eyebrow: 'Step 8 of 12 • Curiosities & Ambitions',
    description: 'Pick the topics and fields that excite you intellectually, and how familiar you already are with them.',
    isSkippable: false
  },
  {
    id: 'achievements',
    stageNumber: 9,
    title: 'What are you proud of so far?',
    eyebrow: 'Step 9 of 12 • Milestones',
    description: 'Add any achievements, certifications, school projects, competitions, or personal milestones.',
    isSkippable: true
  },
  {
    id: 'familyContext',
    stageNumber: 10,
    title: "Is there anything about your background you'd like us to understand?",
    eyebrow: 'Step 10 of 12 • Personal background (optional)',
    description: "You decide what you share. Sensitive personal or family background details require your explicit consent before saving.",
    isSkippable: true,
    isSensitive: true
  },
  {
    id: 'phone',
    stageNumber: 11,
    title: 'How can the placement team reach you?',
    eyebrow: 'Step 11 of 12 • Contact details (optional)',
    description: 'Add a phone number for placement updates, or skip this step for now.',
    isSkippable: true
  },
  {
    id: 'review',
    stageNumber: 12,
    title: 'Review your profile.',
    eyebrow: 'Step 12 of 12 • Review',
    description: 'Check your details below. You can edit any section before completing onboarding.',
    isSkippable: false
  }
];

export const SUGGESTED_HOBBIES = [
  'Photography',
  'Music & Instruments',
  'Sports & Athletics',
  'Gaming & Esports',
  'Reading & Literature',
  'Travel & Hiking',
  'Digital & Traditional Art',
  'Creative Writing',
  'Community Volunteering',
  'Podcasting',
  'Cooking & Baking',
  'Chess & Strategy',
  'Theatre & Film'
];

export const SUGGESTED_PASSIONS = [
  'Artificial Intelligence',
  'Product Design & UX',
  'Clean Energy & Climate Tech',
  'Academic Research',
  'Entrepreneurship & Startups',
  'Public Policy & Social Impact',
  'Quantitative Finance',
  'Human-Computer Interaction',
  'Robotics & Embedded Systems',
  'Cybersecurity',
  'Creative Direction',
  'Biotechnology'
];

/** Skill levels for personal interests (hobbies). */
export const HOBBY_PROFICIENCY_LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'expert', label: 'Expert' }
];

/** Familiarity levels for intellectual domains (curiosities & ambitions). */
export const PASSION_FAMILIARITY_LEVELS = [
  { value: 'exploring', label: 'Exploring' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' }
];

export const DEPARTMENTS = [
  'Computer Science & Engineering',
  'Electronics & Communication Engineering',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Data Science & Artificial Intelligence',
  'Information Technology',
  'Design & Human-Computer Interaction',
  'Business Administration & Management',
  'Biotechnology & Bio-Engineering',
  'Economics & Financial Analytics',
  'Humanities & Social Sciences'
];

export const BATCH_YEARS = [
  '2024 - 2028',
  '2023 - 2027',
  '2022 - 2026',
  '2021 - 2025',
  '2024 - 2026 (Postgraduate)',
  '2023 - 2025 (Postgraduate)'
];

export const ACHIEVEMENT_CATEGORIES = [
  'Academic Honor',
  'Competition / Hackathon',
  'Certification',
  'Personal / Technical Project',
  'Leadership & Club Role',
  'Community Volunteering',
  'Athletics & Sports',
  'Creative & Arts Milestone'
];

/** Institutional email contract: rollnumber@kiit.ac.in (case-insensitive). */
export const INSTITUTIONAL_EMAIL_PATTERN = /^([a-z0-9]+)@kiit\.ac\.in$/i;

/** Extract the roll number portion from a valid institutional email. */
export const extractRollNumber = email => {
  const match = String(email || '').trim().match(INSTITUTIONAL_EMAIL_PATTERN);
  return match ? match[1].toUpperCase() : null;
};
