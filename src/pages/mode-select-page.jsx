import { useState } from 'react';
import { NavButton } from '../components/nav-button.jsx';
import { CliInstallLoader } from '../components/cli-install-loader.jsx';

/**
 * Mode selection page. Presents three options (Easy, Auto, Manual) as
 * selectable cards. The user must pick one before continuing.
 *
 * When Auto or Easy mode is selected, the app checks whether the
 * Bitwarden CLI (`bw`) is installed. If not, a loading screen is shown
 * while it is installed via npm into a temp directory. If the install
 * fails, an error page is shown with options to try again or switch
 * to manual mode.
 *
 * @param {object} props
 * @param {object} props.step - The mode-select entry from onboarding-content.js.
 * @param {function} props.onNext - Advance to the next step (receives selected mode).
 * @param {function} [props.onBack]
 */
export function ModeSelectPage({ step, onNext, onBack }) {
  const [selected, setSelected] = useState(null);
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState(null);

  const handleContinue = async () => {
    // For auto and easy modes, check if the Bitwarden CLI is installed.
    // If not, show the loading screen while it installs.
    if ((selected === 'auto' || selected === 'easy')
        && window.appRuntime?.checkCliInstalled) {
      try {
        const result = await window.appRuntime.checkCliInstalled();
        if (!result?.installed) {
          setInstalling(true);
          return;
        }
      } catch {
        // If the check fails, proceed anyway — the user will get an
        // error at sign-in time if the CLI is missing.
      }
    }
    onNext({ mode: selected });
  };

  // Loading screen while the CLI installs.
  if (installing) {
    return (
      <CliInstallLoader
        onComplete={({ success, error }) => {
          if (success) {
            onNext({ mode: selected });
          } else {
            setInstalling(false);
            setInstallError(error || 'Unknown error');
          }
        }}
      />
    );
  }

  // Error page if the CLI install failed.
  if (installError !== null) {
    return (
      <section className="page page-centred" aria-labelledby="cli-error-heading">
        <div className="page-body page-body-centred">
          <div className="content-card">
            <h1 id="cli-error-heading" className="h3 page-heading">
              Bitwarden CLI install failed
            </h1>
            <p className="intro-paragraph">
              The Bitwarden CLI is required for Auto Mode to work its
              magic. We couldn&apos;t install it automatically.
            </p>
            <p className="intro-paragraph" style={{ fontSize: '0.8rem', color: '#5a6072' }}>
              {installError}
            </p>
            <div className="page-footer">
              <NavButton
                label="Switch to Manual Mode"
                variant="outline-secondary"
                onClick={() => {
                  setInstallError(null);
                  setSelected('manual');
                  onNext({ mode: 'manual' });
                }}
              />
              <NavButton
                label="Try Again"
                onClick={() => {
                  setInstallError(null);
                  setInstalling(true);
                }}
              />
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="page page-centred" aria-labelledby="mode-heading">
      <div className="page-body page-body-centred">
        <div className="content-card">
          <h1 id="mode-heading" className="h3 page-heading">
            {step.heading}
          </h1>
          <p className="intro-paragraph text-center">{step.subtitle}</p>

          <div className="mode-options">
            {step.options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`mode-option${selected === opt.id ? ' selected' : ''}`}
                onClick={() => setSelected(opt.id)}
                aria-pressed={selected === opt.id}
              >
                <span className="mode-option-title">{opt.title}</span>
                <span className="mode-option-desc">{opt.description}</span>
              </button>
            ))}
          </div>

          <div className="page-footer">
            {onBack && (
              <NavButton label="Back" variant="outline-secondary" onClick={onBack} />
            )}
            <NavButton
              label="Continue"
              disabled={!selected}
              onClick={handleContinue}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
