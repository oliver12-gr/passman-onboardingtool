import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { NavButton } from '../components/nav-button.jsx';

/**
 * Browser extension store URLs for each supported browser.
 * Edge and Chrome both use the Chrome Web Store.
 */
const EXTENSION_URLS = {
  edge: 'https://chromewebstore.google.com/detail/bitwarden-free-password-m/nngceckbpebfimnlniiiahkandclblb',
  chrome: 'https://chromewebstore.google.com/detail/bitwarden-free-password-m/nngceckbpebfimnlniiiahkandclblb',
  firefox: 'https://addons.mozilla.org/en-GB/firefox/addon/bitwarden-password-manager/',
  other: 'https://bitwarden.com/download/',
};

/**
 * Mobile app store URLs.
 */
const MOBILE_URLS = {
  android: 'https://play.google.com/store/apps/details?id=com.x8bit.bitwarden',
  ios: 'https://apps.apple.com/us/app/bitwarden-password-manager/id1137397744',
};

/**
 * Install Bitwarden checklist page. Shown after successful Bitwarden
 * sign-in in auto/easy mode. Guides the user through installing
 * Bitwarden on their desktop, browser, and mobile device.
 *
 * The app detects whether steps 1 and 2 are complete:
 * - Step 1: checks if the Bitwarden desktop app is installed (via
 *   `where bw` and common install paths).
 * - Step 2: tracks whether the user clicked the "Install extension"
 *   button (cannot directly detect extension installation from
 *   Electron).
 * - Step 3: tracks whether the user clicked "Show QR code" (cannot
 *   detect actual scan).
 *
 * A "Skip" button at the bottom allows users who already have
 * everything installed to continue.
 *
 * @param {object} props
 * @param {function} props.onNext
 * @param {function} [props.onBack]
 */
export function InstallBitwardenPage({ onNext, onBack }) {
  const [step1Status, setStep1Status] = useState('pending'); // pending | installing | installed | error
  const [step1Error, setStep1Error] = useState('');
  const [step2Done, setStep2Done] = useState(false);
  const [step3Done, setStep3Done] = useState(false);
  const [browser, setBrowser] = useState('other');
  const [showQR, setShowQR] = useState(false);
  const [qrPlatform, setQrPlatform] = useState(null); // 'android' | 'ios' | null

  // Detect the user's default browser on mount.
  useEffect(() => {
    if (window.appRuntime?.detectBrowser) {
      window.appRuntime.detectBrowser().then((result) => {
        if (result?.browser) setBrowser(result.browser);
      });
    }
    // Also check if Bitwarden desktop is already installed.
    if (window.appRuntime?.checkDesktopInstalled) {
      window.appRuntime.checkDesktopInstalled().then((result) => {
        if (result?.installed) setStep1Status('installed');
      });
    }
  }, []);

  const handleInstallDesktop = async () => {
    setStep1Status('installing');
    setStep1Error('');
    try {
      const result = await window.appRuntime?.installBitwardenWindows();
      if (result?.success) {
        setStep1Status('installed');
      } else {
        setStep1Status('error');
        setStep1Error(result?.error || 'Installation failed');
      }
    } catch (err) {
      setStep1Status('error');
      setStep1Error(err.message);
    }
  };

  const handleInstallExtension = () => {
    const url = EXTENSION_URLS[browser] || EXTENSION_URLS.other;
    if (window.appRuntime?.openExternal) {
      window.appRuntime.openExternal(url);
    }
    setStep2Done(true);
  };

  const handleShowQR = (platform) => {
    setQrPlatform(platform);
    setShowQR(true);
    setStep3Done(true);
  };

  const step1Complete = step1Status === 'installed';
  const allStepsComplete = step1Complete && step2Done && step3Done;

  return (
    <section className="page page-centred" aria-labelledby="install-heading">
      <div className="page-body page-body-centred">
        <div className="content-card checker-card">
          <h1 id="install-heading" className="h3 page-heading">
            Install Bitwarden
          </h1>
          <p className="intro-paragraph">
            To get the most out of Bitwarden, install it on all your
            devices. Complete the steps below, or skip if you already
            have everything set up.
          </p>

          {/* Step 1: Desktop app */}
          <div className={`install-step${step1Complete ? ' install-step-complete' : ''}`}>
            <div className="install-step-header">
              <span className="install-step-number">1</span>
              <span className="install-step-title">Install Bitwarden on Windows</span>
              {step1Complete && <span className="install-check">&#10003;</span>}
            </div>
            <p className="install-step-desc">
              {step1Status === 'installed'
                ? 'Bitwarden desktop app detected.'
                : step1Status === 'installing'
                  ? 'Installing via winget... this may take a minute.'
                  : step1Status === 'error'
                    ? `Error: ${step1Error}`
                    : 'Click to install the Bitwarden desktop app.'}
            </p>
            {step1Status !== 'installed' && step1Status !== 'installing' && (
              <NavButton
                label="Install on Windows"
                onClick={handleInstallDesktop}
              />
            )}
            {step1Status === 'installing' && (
              <p className="strength-checking">Installing...</p>
            )}
          </div>

          {/* Step 2: Browser extension */}
          <div className={`install-step${step2Done ? ' install-step-complete' : ''}`}>
            <div className="install-step-header">
              <span className="install-step-number">2</span>
              <span className="install-step-title">Install browser extension</span>
              {step2Done && <span className="install-check">&#10003;</span>}
            </div>
            <p className="install-step-desc">
              {step2Done
                ? 'Extension store opened. Click "Add to browser" to install.'
                : `Detected browser: ${browser === 'edge' ? 'Microsoft Edge' : browser === 'chrome' ? 'Google Chrome' : browser === 'firefox' ? 'Firefox' : 'Unknown'}. Click to open the extension store.`}
            </p>
            {!step2Done && (
              <NavButton
                label="Install extension"
                onClick={handleInstallExtension}
              />
            )}
          </div>

          {/* Step 3: Mobile app */}
          <div className={`install-step${step3Done ? ' install-step-complete' : ''}`}>
            <div className="install-step-header">
              <span className="install-step-number">3</span>
              <span className="install-step-title">Install on mobile</span>
              {step3Done && <span className="install-check">&#10003;</span>}
            </div>
            <p className="install-step-desc">
              {step3Done
                ? 'QR code shown — scan with your phone camera to install.'
                : 'Scan a QR code to install the Bitwarden app on your phone.'}
            </p>
            {!step3Done && (
              <div className="qr-buttons">
                <NavButton
                  label="Android QR"
                  variant="outline-primary"
                  onClick={() => handleShowQR('android')}
                />
                <NavButton
                  label="iOS QR"
                  variant="outline-primary"
                  onClick={() => handleShowQR('ios')}
                />
              </div>
            )}
            {showQR && qrPlatform && (
              <div className="qr-display">
                <QRCodeSVG
                  value={MOBILE_URLS[qrPlatform]}
                  size={160}
                  level="M"
                  aria-label={`QR code for Bitwarden ${qrPlatform} app`}
                />
                <p className="qr-label">
                  Scan with your phone camera to install Bitwarden
                  {' '}
                  ({qrPlatform === 'android' ? 'Google Play' : 'App Store'})
                </p>
              </div>
            )}
          </div>

          <div className="page-footer">
            {onBack && (
              <NavButton
                label="Back"
                variant="outline-secondary"
                onClick={onBack}
              />
            )}
            <NavButton
              label="Skip"
              variant="outline-secondary"
              onClick={onNext}
            />
            <NavButton
              label="Continue"
              disabled={!allStepsComplete}
              onClick={onNext}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
