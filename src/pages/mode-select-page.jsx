import { useState } from 'react';
import { NavButton } from '../components/nav-button.jsx';
import { CliInstallLoader } from '../components/cli-install-loader.jsx';

/**
 * Inline SVG icons for mode cards. Keeps the bundle small and avoids
 * external icon dependencies.
 */
const MODE_ICONS = {
  robot: (
    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="8" width="16" height="12" rx="2" />
      <path d="M12 4v4" />
      <circle cx="12" cy="3" r="1" />
      <circle cx="9" cy="13" r="1.5" />
      <circle cx="15" cy="13" r="1.5" />
      <path d="M9 17h6" />
      <path d="M2 13h2M20 13h2" />
    </svg>
  ),
  key: (
    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="15" r="4" />
      <path d="M10.5 12.5L20 3" />
      <path d="M16 7l3 3" />
      <path d="M18 5l3 3" />
    </svg>
  ),
  clipboard: (
    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="4" width="14" height="18" rx="2" />
      <path d="M9 4V2h6v2" />
      <path d="M9 11h6M9 15h6M9 7h6" />
    </svg>
  ),
};

/**
 * Mode selection page. Presents three options (AI, Standard, Manual) as
 * side-by-side selectable cards with icons. AI Mode is disabled (coming
 * soon). Standard Mode is pre-selected as the default.
 *
 * When Standard (auto) mode is selected, the app checks whether the
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
  const [selected, setSelected] = useState('auto');
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState(null);

  const handleContinue = async () => {
    // For auto (standard) mode, check if the Bitwarden CLI is installed.
    if (selected === 'auto'
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
              The Bitwarden CLI is required for Standard Mode to work its
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
            {step.options.map((opt) => {
              const isDisabled = !!opt.disabled;
              const isSelected = selected === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`mode-option${isSelected ? ' selected' : ''}${isDisabled ? ' disabled' : ''}`}
                  onClick={() => !isDisabled && setSelected(opt.id)}
                  aria-pressed={isSelected}
                  disabled={isDisabled}
                >
                  <span className="mode-option-icon">
                    {MODE_ICONS[opt.icon] || null}
                  </span>
                  <span className="mode-option-title">{opt.title}</span>
                  {opt.badge && (
                    <span className="mode-option-badge">{opt.badge}</span>
                  )}
                </button>
              );
            })}
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
