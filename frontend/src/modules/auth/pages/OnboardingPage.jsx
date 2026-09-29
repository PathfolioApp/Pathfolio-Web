import React from 'react';
import { OnboardingProvider } from '../onboarding/context/OnboardingContext';
import { OnboardingLayout } from '../onboarding/layouts/OnboardingLayout';

export function OnboardingPage() {
  return (
    <OnboardingProvider>
      <OnboardingLayout />
    </OnboardingProvider>
  );
}
