/**
 * Step definitions and metadata for the 13-stage Onboarding Journey.
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
    id: 'name',
    stageNumber: 2,
    title: 'What should we call you?',
    eyebrow: 'Step 2 of 12 • Identity',
    description: 'Your name will be used to personalize your Pathfolio experience and celebrate your milestones.',
    isSkippable: false
  },
  {
    id: 'age',
    stageNumber: 3,
    title: 'How old are you?',
    eyebrow: 'Step 3 of 12 • Demographics',
    description: 'This helps us understand where you are in your academic journey.',
    isSkippable: false
  },
  {
    id: 'email',
    stageNumber: 4,
    title: 'Where can we reach you?',
    eyebrow: 'Step 4 of 12 • Contact',
    description: 'Use your college email so we can connect your account to your student identity.',
    isSkippable: false
  },
  {
    id: 'username',
    stageNumber: 5,
    title: 'Choose your username.',
    eyebrow: 'Step 5 of 12 • Public Handle',
    description: 'This will be your unique personal identity on PathfolioApp.',
    isSkippable: false
  },
  {
    id: 'rollNumber',
    stageNumber: 6,
    title: "Let's connect your college identity.",
    eyebrow: 'Step 6 of 12 • Enrollment',
    description: 'Your roll number helps connect your Pathfolio account to your college enrollment record.',
    isSkippable: false
  },
  {
    id: 'academic',
    stageNumber: 7,
    title: 'Tell us about your college journey.',
    eyebrow: 'Step 7 of 12 • Academic Context',
    description: 'This helps us understand your program, discipline, and graduation cohort.',
    isSkippable: false
  },
  {
    id: 'hobbies',
    stageNumber: 8,
    title: 'What do you enjoy outside the classroom?',
    eyebrow: 'Step 8 of 12 • Personal Interests',
    description: 'Select a few things you love doing in your free time, or add your own.',
    isSkippable: false
  },
  {
    id: 'passions',
    stageNumber: 9,
    title: 'What are you curious about?',
    eyebrow: 'Step 9 of 12 • Curiosities & Ambitions',
    description: 'Tell us about topics, domains, and fields that excite you intellectually.',
    isSkippable: false
  },
  {
    id: 'achievements',
    stageNumber: 10,
    title: 'What are you proud of so far?',
    eyebrow: 'Step 10 of 12 • Milestones',
    description: 'Add any achievements, certifications, school projects, competitions, or personal milestones.',
    isSkippable: true
  },
  {
    id: 'familyContext',
    stageNumber: 11,
    title: "Is there anything about your background you'd like us to understand?",
    eyebrow: 'Step 11 of 12 • Personal Context (Optional)',
    description: "You decide what you share. Sensitive personal or family background details require your explicit consent before saving.",
    isSkippable: true,
    isSensitive: true
  },
  {
    id: 'review',
    stageNumber: 12,
    title: 'Review your initial record.',
    eyebrow: 'Step 12 of 12 • Verification',
    description: 'Take a moment to review the information you shared before we initialize your Pathfolio journey.',
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
