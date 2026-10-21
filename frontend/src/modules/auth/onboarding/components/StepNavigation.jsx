import React from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import './StepNavigation.css';

export function StepNavigation({
  onNext,
  onPrev,
  onSkip,
  isSkippable = false,
  showNext = true,
  isSubmitting = false,
  nextLabel = 'Continue',
  prevLabel = 'Back',
  skipLabel = 'Skip for now',
  isFinalStep = false
}) {
  return (
    <div className="pf-step-nav">
      <div className="pf-step-nav__left">
        <Button
          variant="ghost"
          size="md"
          onClick={onPrev}
          icon={ArrowLeft}
          iconPosition="left"
          disabled={isSubmitting}
        >
          {prevLabel}
        </Button>
      </div>

      <div className="pf-step-nav__right">
        {isSkippable && (
          <Button
            variant="ghost"
            size="md"
            onClick={onSkip}
            disabled={isSubmitting}
            className="pf-step-nav__skip-btn"
          >
            {skipLabel}
          </Button>
        )}

        {showNext && <Button
          variant="primary"
          size="md"
          onClick={onNext}
          loading={isSubmitting}
          icon={isFinalStep ? Check : ArrowRight}
          iconPosition="right"
        >
          {nextLabel}
        </Button>}
      </div>
    </div>
  );
}
