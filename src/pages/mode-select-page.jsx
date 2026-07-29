import { useState } from 'react';
import { NavButton } from '../components/nav-button.jsx';

/**
 * Mode selection page. Presents three options (Easy, Auto, Manual) as
 * selectable cards. The user must pick one before continuing.
 *
 * @param {object} props
 * @param {object} props.step - The mode-select entry from onboarding-content.js.
 * @param {function} props.onNext - Advance to the next step (receives selected mode).
 * @param {function} [props.onBack]
 */
export function ModeSelectPage({ step, onNext, onBack }) {
  const [selected, setSelected] = useState(null);

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
              onClick={() => onNext({ mode: selected })}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
