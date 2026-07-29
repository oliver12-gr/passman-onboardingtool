import { ProgressBar } from 'react-bootstrap';
import { useApp } from '../app/app-context.jsx';

/**
 * Persistent top-of-screen progress indicator for the onboarding phase.
 * Driven by `progress` from the app context (0..100). The title
 * "Digital Healthcheck" sits on its own line, and "progress:" appears
 * inline with the bar.
 */
export function ProgressBarTop() {
  const { progress } = useApp();
  return (
    <div className="progress-bar-wrapper" role="status" aria-live="polite">
      <div className="progress-bar-title">Digital Healthcheck</div>
      <div className="progress-bar-row">
        <span className="progress-bar-label">PROGRESS:</span>
        <ProgressBar
          now={progress}
          label={`${progress}%`}
          aria-label={`Digital Healthcheck progress: ${progress}%`}
          className={`progress-bar-main${progress >= 100 ? ' progress-bar-complete' : ''}`}
        />
      </div>
    </div>
  );
}
