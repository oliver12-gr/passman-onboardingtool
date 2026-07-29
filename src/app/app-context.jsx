import { createContext, useContext } from 'react';

/**
 * App-wide state. Phase 1 tracks only the current phase and progress.
 * Stateless by design: nothing here is persisted to disk.
 *
 * Phases:
 *   - 'intro'      : education + strength checker screens
 *   - 'onboarding' : post "Get Started", progress bar visible
 */

export const PHASES = Object.freeze({
  INTRO: 'intro',
  ONBOARDING: 'onboarding',
});

export const initialState = {
  phase: PHASES.INTRO,
  progress: 0, // 0..100, only meaningful in the onboarding phase
};

export const AppContext = createContext(initialState);

/**
 * @param {object} state - Current app state.
 * @param {object} action - Dispatched action.
 * @returns {object} Next state.
 */
export function appReducer(state, action) {
  switch (action.type) {
    case 'START_ONBOARDING':
      return { ...state, phase: PHASES.ONBOARDING, progress: 0 };
    case 'SET_PROGRESS':
      return {
        ...state,
        progress: Math.max(0, Math.min(100, action.value)),
      };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

/**
 * Hook accessor for the app context.
 * @returns {object} The current app state.
 */
export function useApp() {
  return useContext(AppContext);
}
