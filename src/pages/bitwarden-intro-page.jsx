import { useState } from 'react';
import { Form, InputGroup } from 'react-bootstrap';
import { NavButton } from '../components/nav-button.jsx';

/**
 * Formats a Bitwarden CLI error message into a user-friendly string.
 * Detects common network and server errors and replaces the raw JSON
 * with a clean, actionable message.
 * @param {string} message - The raw error message.
 * @returns {string}
 */
function formatBwError(message) {
  if (!message) return 'An unexpected error occurred.';

  const msg = message.toLowerCase();

  // Network / server unreachable errors.
  if (msg.includes('enoent') || msg.includes('spawn bw')) {
    return 'The Bitwarden CLI could not be found. Please try again or switch to Manual Mode.';
  }
  if (msg.includes('522') || msg.includes('connection timed out')) {
    return 'The Bitwarden server is temporarily unavailable. Please wait a moment and try again, or try a different server (US/EU).';
  }
  if (msg.includes('503') || msg.includes('service unavailable')) {
    return 'The Bitwarden server is temporarily unavailable. Please try again in a few minutes.';
  }
  if (msg.includes('401') || msg.includes('unauthorized')) {
    return 'Your email or password is incorrect. Please check your credentials and try again.';
  }
  if (msg.includes('429') || msg.includes('rate limit')) {
    return 'Too many login attempts. Please wait a few minutes before trying again.';
  }
  if (msg.includes('etr')) {
    return 'Too many login attempts. Please wait a few minutes before trying again.';
  }
  if (msg.includes('captcha')) {
    return 'Bitwarden requires a captcha challenge for this login. Please log in via the Bitwarden web vault to verify your account, then try again.';
  }
  if (msg.includes('invalid email') || msg.includes('invalid username')) {
    return 'The email address you entered is not recognised by Bitwarden.';
  }
  if (msg.includes('network') || msg.includes('econnrefused') || msg.includes('econnreset')) {
    return 'Could not connect to the Bitwarden server. Please check your internet connection and try again.';
  }
  if (msg.includes('unable to fetch serverconfig')) {
    return 'Could not reach the Bitwarden server. Please check your internet connection, try a different server, or try again in a few minutes.';
  }

  // If the error contains JSON (like the Cloudflare error), strip it out
  // and just show the first meaningful line.
  const firstLine = message.split('\n')[0].trim();
  if (firstLine.length > 0 && firstLine.length < 200) {
    return firstLine;
  }

  return 'Sign-in failed. Please check your credentials and try again.';
}

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
  const [mfaMethod, setMfaMethod] = useState(0); // 0=Authenticator, 1=Email, 3=YubiKey
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
        // Default to authenticator app if available.
        if (result.methods?.length > 0) {
          setMfaMethod(result.methods[0]);
        }
        setStatus('mfa');
        return;
      }

      if (result?.success) {
        setStatus('success');
        onNext({ bitwardenConnected: true });
        return;
      }

      setStatus('error');
      setError(formatBwError(result?.error) || 'Sign-in failed. Please check your credentials.');
    } catch (err) {
      setStatus('error');
      setError(formatBwError(err.message));
    }
  };

  const handleMfaSubmit = async () => {
    setError('');
    setStatus('connecting');

    try {
      const result = await window.appRuntime?.bitwardenMfa({
        code: mfaCode,
        method: mfaMethod,
        email,
        password,
      });

      if (result?.success) {
        setStatus('success');
        onNext({ bitwardenConnected: true });
        return;
      }

      setStatus('error');
      setError(formatBwError(result?.error) || 'MFA verification failed.');
    } catch (err) {
      setStatus('error');
      setError(formatBwError(err.message));
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
              <Form.Label>Two-factor authentication method</Form.Label>
              <Form.Select
                value={mfaMethod}
                onChange={(e) => setMfaMethod(Number(e.target.value))}
                aria-label="MFA method"
                className="mb-2"
              >
                <option value={0}>Authenticator app</option>
                <option value={1}>Email</option>
                <option value={3}>YubiKey</option>
              </Form.Select>
              <Form.Label>Enter your verification code</Form.Label>
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
