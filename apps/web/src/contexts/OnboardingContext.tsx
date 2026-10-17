'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

const STEP_KEY = 'cv_onboarding_step';
const DATA_KEY = 'cv_onboarding_data';

interface OnboardingContextType {
  currentStep: number;
  setCurrentStep: (step: number) => void;
  resetOnboarding: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [currentStep, setCurrentStepRaw] = useState(0);

  // Restore persisted step after hydration
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STEP_KEY);
      if (stored) {
        const step = parseInt(stored, 10);
        if (!isNaN(step) && step >= 0) setCurrentStepRaw(step);
      }
    } catch {
      /* non-critical */
    }
  }, []);

  const setCurrentStep = useCallback((step: number) => {
    setCurrentStepRaw(step);
    try {
      localStorage.setItem(STEP_KEY, String(step));
    } catch {
      /* non-critical */
    }
  }, []);

  const resetOnboarding = useCallback(() => {
    setCurrentStepRaw(0);
    try {
      localStorage.removeItem(STEP_KEY);
      localStorage.removeItem(DATA_KEY);
    } catch {
      /* non-critical */
    }
  }, []);

  return (
    <OnboardingContext.Provider value={{ currentStep, setCurrentStep, resetOnboarding }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
