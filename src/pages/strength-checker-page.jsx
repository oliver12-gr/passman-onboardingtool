import { useEffect, useRef, useState } from 'react';
import { Form, InputGroup } from 'react-bootstrap';
import { NavButton } from '../components/nav-button.jsx';
import { StrengthMeter } from '../components/strength-meter.jsx';
import { evaluateStrength } from '../scripts/strength-evaluator.js';
import { useApp } from '../app/app-context.jsx';

/**
 * Final intro screen: interactive password strength checker.
 *
 * SECURITY: the entered password lives only in this component's state for
 * the duration of the check. It is cleared on unmount and never logged,
 * persisted, or sent over the network. No autocomplete, no clipboard copy.
 *
 * Layout: two cards — the first contains the header, input, and results;
 * the second contains the passphrase explanation.
 *
 * @param {object} props
 * @param {object} props.page - The strength-checker content entry.
 * @param {function} [props.onBack]
 * @param {boolean} props.isLast
 */
export function StrengthCheckerPage({ page, onBack, isLast }) {
  const { dispatch } = useApp();
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const debounceRef = useRef(null);

  // Re-evaluate (debounced) whenever the input changes.
  useEffect(() => {
    if (!value) return; // nothing to evaluate; display is gated on `value`

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      evaluateStrength(value).then((res) => {
        setResult(res);
        setChecking(false);
      });
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  // SECURITY: wipe the password from state on unmount.
  useEffect(() => {
    return () => {
      setValue('');
      setResult(null);
      setChecking(false);
    };
  }, []);

  const handleGetStarted = () => {
    // Wipe before transitioning so the secret never outlives this screen.
    setValue('');
    setResult(null);
    setChecking(false);
    dispatch({ type: 'START_ONBOARDING' });
  };

  return (
    <section className="page page-centred" aria-labelledby="strength-heading">
      <div className="page-body page-body-centred">
        <div className="content-card checker-card">
          <h1 id="strength-heading" className="h3 page-heading">
            {page.heading}
          </h1>
          <p className="intro-paragraph">
            {page.bodyBefore} <strong><em>{page.bodyBold}</em></strong>{' '}
            {page.bodyAfter}
          </p>

          <Form.Group className="mt-3" controlId="strength-input">
            <InputGroup>
              <Form.Control
                type={show ? 'text' : 'password'}
                placeholder="Type a password to check"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  if (e.target.value) {
                    setChecking(true);
                  } else {
                    setResult(null);
                    setChecking(false);
                  }
                }}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                aria-label="Password to check"
              />
              <NavButton
                label={show ? 'Hide' : 'Show'}
                variant="outline-secondary"
                onClick={() => setShow((s) => !s)}
              />
            </InputGroup>
          </Form.Group>

          <StrengthMeter
            verdict={value ? result?.verdict ?? null : null}
            entropyBits={value ? result?.entropyBits ?? 0 : 0}
            suggestion={value ? result?.suggestion ?? '' : ''}
            checking={checking}
          />

          <div className="page-footer">
            {onBack && (
              <NavButton label="Back" variant="outline-secondary" onClick={onBack} />
            )}
            {isLast && (
              <NavButton label="Get Started" onClick={handleGetStarted} />
            )}
          </div>
        </div>

        <div className="content-card info-card text-start mt-3">
          <p>
            {page.cardParagraphs[0]}{' '}
            <span className="passphrase-text">{page.passphraseGood}</span>{' '}
            {page.cardParagraphs[1]}{' '}
            <span className="passphrase-text">{page.passphraseBad}</span>
          </p>
          <p>{page.cardParagraphs2[0]}</p>
          <p className="info-card-italic">{page.cardItalicLine}</p>
        </div>
      </div>
    </section>
  );
}
