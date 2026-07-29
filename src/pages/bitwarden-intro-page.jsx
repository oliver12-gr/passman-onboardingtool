import { useState } from 'react';
import { Form, InputGroup } from 'react-bootstrap';
import { NavButton } from '../components/nav-button.jsx';

/**
 * Bitwarden introduction and sign-in page. Tells the user we'll use
 * Bitwarden, lets them select a server (US/EU/self-hosted), and prompts
 * for their Bitwarden credentials. Handles MFA challenges via the
 * backend IPC bridge.
 *
 * SECURITY: credentials are sent only via IPC to the Electron main
 * process (in-process, not network) and never logged or persisted by
 * the renderer. The main process passes them to the bitwarden-cli.
 *
 * @param {object} props
 * @param {object} props.step - The bitwarden-intro entry from onboarding-content.js.
 * @param {function} props.onNext - Advance to the next step.
 * @param {function} [props.onBack]
 * @param {function} [props.onSkip] - Skip to the next step without signing in.
 */
export function BitwardenIntroPage({ step, onNext, onBack, onSkip }) {
  const [serverId, setServerId] = useState('us');
  const [selfHostedUrl, setSelfHostedUrl] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | connecting | mfa | error | success
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState('');

  const server = step.servers.find((s) => s.id === serverId);
  const serverUrl = serverId === 'self' ? selfHostedUrl : server?.url;

  const handleSignIn = async () => {
    setError('');
    setStatus('connecting');

    try {
      const result = await window.appRuntime?.bitwardenLogin({
        serverUrl,
        email,
        password,
      });

      if (result?.needsMfa) {
        setStatus('mfa');
        return;
      }

      if (result?.success) {
        setStatus('success');
        onNext({ bitwardenConnected: true });
        return;
      }

      setStatus('error');
      setError(result?.error || 'Sign-in failed. Please check your credentials.');
    } catch (err) {
      setStatus('error');
      setError(err.message || 'An unexpected error occurred.');
    }
  };

  const handleMfaSubmit = async () => {
    setError('');
    setStatus('connecting');

    try {
      const result = await window.appRuntime?.bitwardenMfa({ code: mfaCode });

      if (result?.success) {
        setStatus('success');
        onNext({ bitwardenConnected: true });
        return;
      }

      setStatus('error');
      setError(result?.error || 'MFA verification failed.');
    } catch (err) {
      setStatus('error');
      setError(err.message || 'An unexpected error occurred.');
    }
  };

  const canSignIn =
    email && password && (serverId !== 'self' || selfHostedUrl);

  return (
    <section className="page page-centred" aria-labelledby="bw-heading">
      <div className="page-body page-body-centred">
        <div className="content-card checker-card">
          <h1 id="bw-heading" className="h3 page-heading">
            {step.heading}
          </h1>
          <p className="intro-paragraph">{step.body}</p>

          {status === 'mfa' ? (
            <Form.Group className="mt-3" controlId="mfa-code">
              <Form.Label>Enter your two-factor authentication code</Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g. 123456"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                autoComplete="one-time-code"
                aria-label="MFA code"
              />
              <div className="page-footer">
                <NavButton
                  label="Verify"
                  disabled={!mfaCode}
                  onClick={handleMfaSubmit}
                />
              </div>
            </Form.Group>
          ) : status === 'success' ? (
            <p className="intro-paragraph text-center">
              Connected to Bitwarden successfully!
            </p>
          ) : (
            <>
              <Form.Group className="mt-3" controlId="bw-server">
                <Form.Label>Server</Form.Label>
                <Form.Select
                  value={serverId}
                  onChange={(e) => setServerId(e.target.value)}
                  aria-label="Bitwarden server"
                >
                  {step.servers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </Form.Select>
                {serverId === 'self' && (
                  <Form.Control
                    className="mt-2"
                    type="url"
                    placeholder="https://your-server.com"
                    value={selfHostedUrl}
                    onChange={(e) => setSelfHostedUrl(e.target.value)}
                    aria-label="Self-hosted server URL"
                  />
                )}
              </Form.Group>

              <Form.Group className="mt-3" controlId="bw-email">
                <Form.Label>Email</Form.Label>
                <Form.Control
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="off"
                  aria-label="Bitwarden email"
                />
              </Form.Group>

              <Form.Group className="mt-3" controlId="bw-password">
                <Form.Label>Master password</Form.Label>
                <InputGroup>
                  <Form.Control
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Master password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="off"
                    aria-label="Bitwarden master password"
                  />
                  <NavButton
                    label={showPassword ? 'Hide' : 'Show'}
                    variant="outline-secondary"
                    onClick={() => setShowPassword((s) => !s)}
                  />
                </InputGroup>
              </Form.Group>

              {status === 'connecting' && (
                <p className="strength-checking mt-3">
                  Connecting<span className="checking-dots"><span>.</span><span>.</span><span>.</span></span>
                </p>
              )}

              {status === 'error' && (
                <p className="text-danger mt-3" role="alert">{error}</p>
              )}

              <div className="page-footer">
                {onBack && (
                  <NavButton
                    label="Back"
                    variant="outline-secondary"
                    onClick={onBack}
                  />
                )}
                <NavButton
                  label="Sign In"
                  disabled={!canSignIn || status === 'connecting'}
                  onClick={handleSignIn}
                />
              </div>

              <div className="signup-link">
                <p>Don{"'"}t have a Bitwarden account?</p>
                <NavButton
                  label="Sign Up"
                  variant="outline-primary"
                  onClick={() => {
                    if (window.appRuntime?.openExternal) {
                      window.appRuntime.openExternal(step.signUpUrl);
                    }
                  }}
                />
              </div>

              {onSkip && (
                <button
                  type="button"
                  className="skip-link"
                  onClick={onSkip}
                >
                  skip: use manual mode instead
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
