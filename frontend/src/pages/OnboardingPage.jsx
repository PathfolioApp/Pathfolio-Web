import React from 'react';
import { OnboardingProvider } from '../features/onboarding/context/OnboardingContext';
import { OnboardingLayout } from '../features/onboarding/layouts/OnboardingLayout';

export function OnboardingPage() {
  return (
    <OnboardingProvider>
      <OnboardingLayout />
    </OnboardingProvider>
  );
}
