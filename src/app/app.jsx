import { useReducer } from 'react';
import { AppContext, appReducer, initialState, PHASES } from './app-context.jsx';
import { CleanupProvider } from './cleanup-context.jsx';
import { IntroFlow } from '../pages/intro-flow.jsx';
import { OnboardingFlow } from '../pages/onboarding-flow.jsx';
import { KeyParticles } from '../components/key-particles.jsx';
import { GlobalCloseButton } from '../components/global-close-button.jsx';

/**
 * Root component. Renders the animated key/padlock background behind all
 * pages, then decides which top-level flow to show based on phase.
 *
 * Wrapped in CleanupProvider so the global X button and the final close
 * button share the same data-deletion logic.
 */
export function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ ...state, dispatch }}>
      <CleanupProvider>
        <div className="app-shell">
          <KeyParticles />
          <GlobalCloseButton />
          <div className="app-content">
            {state.phase === PHASES.INTRO ? (
              <IntroFlow />
            ) : (
              <OnboardingFlow />
            )}
          </div>
        </div>
      </CleanupProvider>
    </AppContext.Provider>
  );
}
