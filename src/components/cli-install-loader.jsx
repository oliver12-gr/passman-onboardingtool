import { useEffect, useRef, useState } from 'react';
import { ProgressBar } from 'react-bootstrap';

/**
 * Loading screen shown while the Bitwarden CLI is being installed.
 * Cycles through three humorous status messages and animates a
 * percentage from 0 to 100 over the install duration.
 *
 * @param {object} props
 * @param {function} props.onComplete - Called with {success, error} when the install finishes.
 */
const LOADING_MESSAGES = [
  'Preparing healthcheck automations',
  'Conferring with the security czars',
  'Telling hackers to buzz off',
];

export function CliInstallLoader({ onComplete }) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  // Store the callback in a ref so the install effect only runs once
  // on mount, even if the parent re-renders and passes a new function.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Cycle through the three messages every 2.5 seconds.
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  // Animate the progress bar. We simulate progress moving toward 95%
  // (holding just under 100 until the install actually completes),
  // then jump to 100 when done.
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 95) return p;
        // Slow down as we approach 95.
        const increment = p < 30 ? 3 : p < 60 ? 2 : p < 80 ? 1 : 0.5;
        return Math.min(95, p + increment);
      });
    }, 200);
    return () => clearInterval(interval);
  }, []);

  // Kick off the CLI install on mount — runs only once.
  useEffect(() => {
    let cancelled = false;

    const install = async () => {
      try {
        const result = await window.appRuntime?.installBitwardenCli();
        if (cancelled) return;

        setProgress(100);

        // Brief pause at 100% so the user sees completion.
        setTimeout(() => {
          if (cancelled) return;
          onCompleteRef.current({ success: !!result?.success, error: result?.error });
        }, 600);
      } catch (err) {
        if (cancelled) return;
        setProgress(100);
        setTimeout(() => {
          if (cancelled) return;
          onCompleteRef.current({ success: false, error: err.message });
        }, 600);
      }
    };

    install();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="page page-centred" aria-labelledby="cli-loader-heading">
      <div className="page-body page-body-centred">
        <div className="content-card cli-loader-card">
          <h1 id="cli-loader-heading" className="h3 page-heading">
            Setting up Auto Mode
          </h1>
          <p className="cli-loader-percent">{Math.round(progress)}%</p>
          <ProgressBar now={progress} className="strength-bar" />
          <p className="cli-loader-message">
            {LOADING_MESSAGES[messageIndex]}...
          </p>
        </div>
      </div>
    </section>
  );
}
