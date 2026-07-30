import { useEffect, useMemo, useState } from 'react';
import { ProgressBarTop } from '../components/progress-bar.jsx';
import { ONBOARDING_STEPS } from '../content/onboarding-content.js';
import { ModeSelectPage } from './mode-select-page.jsx';
import { BitwardenIntroPage } from './bitwarden-intro-page.jsx';
import { InstallBitwardenPage } from './install-bitwarden-page.jsx';
import { AccountCollectionPage } from './account-collection-page.jsx';
import { useApp } from '../app/app-context.jsx';

/**
 * Maps a page kind to its renderer component.
 * @type {Record<string, import('react').ComponentType>}
 */
const PAGE_COMPONENTS = {
  'mode-select': ModeSelectPage,
  'bitwarden-intro': BitwardenIntroPage,
  'install-bitwarden': InstallBitwardenPage,
  'account-collection': AccountCollectionPage,
};

/**
 * Weight assigned to each top-level step. The account collection step
 * has a higher weight because it contains multiple internal phases
 * (collect categories, review, submit, import-instructions, cleanup).
 * Weights determine how much of the progress bar each step occupies.
 */
const STEP_WEIGHTS = {
  'mode-select': 1,
  'bitwarden-intro': 1,
  'install-bitwarden': 1,
  'account-collection': 6,
};

export function OnboardingFlow() {
  const { dispatch } = useApp();
  const [mode, setMode] = useState(null);
  const [bitwardenConnected, setBitwardenConnected] = useState(false);
  const [skippedBitwarden, setSkippedBitwarden] = useState(false);
  const [index, setIndex] = useState(0);
  // Sub-progress within the current step (0..1). Used by the account
  // collection page to report its internal phase progress.
  const [subProgress, setSubProgress] = useState(0);

  // Build the active step list based on the selected mode and whether
  // the user skipped the Bitwarden sign-in.
  const steps = useMemo(() => {
    if (!mode) return [ONBOARDING_STEPS[0]]; // only mode-select

    const baseSteps = ONBOARDING_STEPS.filter((s) => {
      if (s.kind === 'bitwarden-intro' && mode === 'manual') return false;
      return true;
    });

    // Insert the install-bitwarden step after the Bitwarden intro,
    // but only if the user actually signed in (didn't skip).
    const result = [];
    for (const s of baseSteps) {
      result.push(s);
      if (s.kind === 'bitwarden-intro' && !skippedBitwarden) {
        result.push({
          id: 'install-bitwarden',
          kind: 'install-bitwarden',
          heading: 'Install Bitwarden',
        });
      }
    }

    result.push({
      id: 'account-collection',
      kind: 'account-collection',
      heading: 'Secure your accounts',
    });

    return result;
  }, [mode, skippedBitwarden]);

  const step = steps[index];
  const isLast = index === steps.length - 1;

  // Calculate total weight and completed weight for the progress bar.
  const progress = useMemo(() => {
    const total = steps.reduce(
      (sum, s) => sum + (STEP_WEIGHTS[s.kind] || 1),
      0,
    );
    let completed = 0;
    for (let i = 0; i < index; i++) {
      completed += STEP_WEIGHTS[steps[i].kind] || 1;
    }
    const currentWeight = STEP_WEIGHTS[step.kind] || 1;
    const currentFraction = step.kind === 'account-collection'
      ? subProgress
      : 0; // non-collection steps show full weight when reached
    completed += currentWeight * currentFraction;

    return Math.round((completed / total) * 100);
  }, [steps, index, step, subProgress]);

  // Keep the progress bar in sync.
  useEffect(() => {
    dispatch({ type: 'SET_PROGRESS', value: progress });
  }, [dispatch, progress]);

  const goNext = (data) => {
    if (step.kind === 'mode-select' && data?.mode) {
      setMode(data.mode);
      // When mode is first set, the steps list grows from 1 item to
      // several. Don't check isLast here — it's based on the old
      // 1-item list and would prevent advancing.
      setSubProgress(0);
      setIndex((i) => i + 1);
      return;
    }
    if (step.kind === 'bitwarden-intro' && data?.bitwardenConnected) {
      setBitwardenConnected(true);
    }
    if (isLast) return;
    setSubProgress(0);
    setIndex((i) => i + 1);
  };

  const goBack = () => {
    if (index === 0) return;
    setSubProgress(0);
    setIndex((i) => i - 1);
  };

  const handleSkip = () => {
    if (step.kind === 'bitwarden-intro') {
      setSkippedBitwarden(true);
    }
    if (isLast) return;
    setSubProgress(0);
    setIndex((i) => i + 1);
  };

  const PageComponent = PAGE_COMPONENTS[step.kind];
  if (!PageComponent) {
    return (
      <>
        <ProgressBarTop />
        <section className="page">
          <div className="page-body">
            <h1 className="h3 page-heading">Unknown step</h1>
            <p>No component is registered for step kind: {step.kind}</p>
          </div>
        </section>
      </>
    );
  }

  const effectiveMode = skippedBitwarden ? 'manual' : mode;
  const extraProps = step.kind === 'account-collection'
    ? {
        mode: effectiveMode,
        bitwardenConnected,
        onSubProgress: setSubProgress,
      }
    : {};

  return (
    <>
      {/* Hide the progress bar on the mode-select page — there's only
          one step at that point so the bar adds no value. */}
      {step.kind !== 'mode-select' && <ProgressBarTop />}
      <PageComponent
        step={step}
        onNext={goNext}
        onBack={index > 0 ? goBack : undefined}
        isLast={isLast}
        onSkip={step.kind === 'bitwarden-intro' ? handleSkip : undefined}
        {...extraProps}
      />
    </>
  );
}
