import { useState } from 'react';
import { INTRO_PAGES } from '../content/intro-content.js';
import { IntroPage } from './intro-page.jsx';
import { WelcomePage } from './welcome-page.jsx';
import { StrengthCheckerPage } from './strength-checker-page.jsx';

/**
 * Triggers a preload of the rockyou dictionary in the Electron main
 * process so it's ready in memory by the time the user reaches the
 * password checker. Falls back to a no-op outside Electron.
 */
function preloadDictionary() {
  if (typeof window !== 'undefined' && window.appRuntime?.preloadDictionary) {
    window.appRuntime.preloadDictionary();
  }
}

/**
 * Orchestrates the intro flow: walks through each page in INTRO_PAGES,
 * rendering the welcome screen, a static IntroPage, or the interactive
 * strength checker depending on the page kind.
 */
export function IntroFlow() {
  const [index, setIndex] = useState(0);
  const page = INTRO_PAGES[index];
  const isLast = index === INTRO_PAGES.length - 1;

  const goNext = () => setIndex((i) => Math.min(i + 1, INTRO_PAGES.length - 1));
  const goBack = () => setIndex((i) => Math.max(i - 1, 0));

  // When leaving the welcome page, kick off the dictionary preload.
  const handleWelcomeNext = () => {
    preloadDictionary();
    goNext();
  };

  if (page.kind === 'welcome') {
    return <WelcomePage onNext={handleWelcomeNext} />;
  }

  if (page.kind === 'strength-checker') {
    return (
      <StrengthCheckerPage
        page={page}
        onBack={index > 0 ? goBack : undefined}
        isLast={isLast}
      />
    );
  }

  return (
    <IntroPage
      page={page}
      onNext={goNext}
      onBack={index > 0 ? goBack : undefined}
      isLast={isLast}
    />
  );
}
