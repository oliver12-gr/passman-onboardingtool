import { useEffect, useRef, useState } from 'react';
import { Form, InputGroup, ProgressBar } from 'react-bootstrap';
import { NavButton } from '../components/nav-button.jsx';
import { ACCOUNT_CATEGORIES, IMPORT_FORMATS } from '../content/account-content.js';
import { generateImportFile } from '../scripts/import-generator.js';
import { useCleanup } from '../app/cleanup-context.jsx';

/**
 * Maps email domains to their webmail provider URLs. Used to smart
 * auto-fill the URL field for the email service when the user types
 * their email address.
 */
const EMAIL_DOMAIN_URLS = {
  'gmail.com': 'https://mail.google.com',
  'googlemail.com': 'https://mail.google.com',
  'outlook.com': 'https://outlook.live.com',
  'outlook.co.uk': 'https://outlook.live.com',
  'hotmail.com': 'https://outlook.live.com',
  'hotmail.co.uk': 'https://outlook.live.com',
  'live.com': 'https://outlook.live.com',
  'live.co.uk': 'https://outlook.live.com',
  'msn.com': 'https://outlook.live.com',
  'protonmail.com': 'https://mail.proton.me',
  'proton.me': 'https://mail.proton.me',
  'pm.me': 'https://mail.proton.me',
  'yahoo.com': 'https://mail.yahoo.com',
  'yahoo.co.uk': 'https://mail.yahoo.com',
  'icloud.com': 'https://www.icloud.com/mail',
  'me.com': 'https://www.icloud.com/mail',
  'mac.com': 'https://www.icloud.com/mail',
};

/**
 * Looks up the webmail URL for a given email address based on its domain.
 * @param {string} email
 * @returns {string|null} The provider URL, or null if the domain is unknown.
 */
function lookupEmailUrl(email) {
  if (!email || !email.includes('@')) return null;
  const domain = email.split('@').pop().toLowerCase().trim();
  return EMAIL_DOMAIN_URLS[domain] || null;
}

/**
 * Account collection flow. Walks the user through each account category
 * (essential, social, subscriptions), then a review screen, then either:
 *
 * - Auto mode: a loading screen that saves each item to Bitwarden via
 *   the CLI, tracking progress.
 * - Manual mode: a format selection + download screen.
 *
 * After completion: a final data deletion screen that wipes all entered
 * data and closes the app.
 *
 * SECURITY: credentials live only in component state for the duration
 * of the collection. They are cleared on unmount and on the final
 * deletion step.
 *
 * @param {object} props
 * @param {string} props.mode - 'easy' | 'auto' | 'manual'
 * @param {boolean} props.bitwardenConnected
 * @param {function} props.onNext
 * @param {function} [props.onBack]
 */

/**
 * Collects all entered accounts from state into a flat array.
 * @param {object} selectedServices
 * @param {object} credentials
 * @returns {object[]}
 */
function collectAccounts(selectedServices, credentials) {
  const accounts = [];
  for (const cat of ACCOUNT_CATEGORIES) {
    for (const svc of cat.services) {
      if (!selectedServices[svc.id]) continue;
      const cred = credentials[svc.id] || {};
      const url = cred.url || svc.url || '';

      // For email accounts, use "Email - [domain]" as the item name
      // instead of the generic "Email provider" label.
      let name = svc.name;
      if (svc.id === 'email' && url) {
        let domain = url;
        try { domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname; }
        catch { /* keep raw value if URL parsing fails */ }
        name = `Email - ${domain}`;
      }

      accounts.push({
        id: svc.id,
        name,
        username: cred.username || '',
        password: cred.password || '',
        url,
        ios: svc.ios || '',
        android: svc.android || '',
        notes: '',
        category: cat.name,
      });
    }
  }
  return accounts;
}

export function AccountCollectionPage({ mode, bitwardenConnected, onBack, onSubProgress }) {
  // Flow phases: 'collect' → 'review' → 'submit' → 'import-instructions' → 'done'
  const [phase, setPhase] = useState('collect');
  const [catIndex, setCatIndex] = useState(0);
  const [selectedServices, setSelectedServices] = useState({});
  const [credentials, setCredentials] = useState({});
  const [importFormat, setImportFormat] = useState('bitwarden-csv');
  const [submitProgress, setSubmitProgress] = useState(0);
  const [submitStatus, setSubmitStatus] = useState('');
  const [submitErrors, setSubmitErrors] = useState([]);
  const [downloadPath, setDownloadPath] = useState('');
  // Prevents handleAutoSubmit from being called multiple times.
  const hasStartedSaveRef = useRef(false);

  const isAutoMode = mode === 'auto' || (mode === 'easy' && bitwardenConnected);
  const category = ACCOUNT_CATEGORIES[catIndex];

  const { requestClose, registerClear, registerFile } = useCleanup();

  // Register the data-clearing function and file path with the
  // global cleanup context so the X button and final close button
  // both trigger the same deletion.
  useEffect(() => {
    if (registerClear) {
      registerClear(() => {
        setSelectedServices({});
        setCredentials({});
        setSubmitProgress(0);
      });
    }
  }, [registerClear]);

  useEffect(() => {
    if (downloadPath && registerFile) {
      registerFile(downloadPath);
    }
  }, [downloadPath, registerFile]);

  // Report sub-progress to the global progress bar.
  // Sub-steps: collect (3 categories), review, submit, [import-instructions], done
  // Auto mode: 6 sub-steps, Manual mode: 7 sub-steps (with import-instructions).
  const totalSubSteps = isAutoMode ? 6 : 7;

  useEffect(() => {
    let subStep = 0;
    if (phase === 'collect') {
      subStep = catIndex; // 0, 1, 2
    } else if (phase === 'review') {
      subStep = 3;
    } else if (phase === 'submit') {
      subStep = 4;
    } else if (phase === 'import-instructions') {
      subStep = 5;
    } else if (phase === 'done') {
      subStep = totalSubSteps; // 100%
    }
    if (onSubProgress) {
      onSubProgress(subStep / totalSubSteps);
    }
  }, [phase, catIndex, isAutoMode, totalSubSteps, onSubProgress]);

  const isLastCategory = catIndex === ACCOUNT_CATEGORIES.length - 1;

  const toggleService = (serviceId) => {
    setSelectedServices((prev) => ({
      ...prev,
      [serviceId]: !prev[serviceId],
    }));
  };

  const updateCredential = (serviceId, field, value) => {
    setCredentials((prev) => ({
      ...prev,
      [serviceId]: { ...prev[serviceId], [field]: value },
    }));
  };

  /**
   * Handles username/email changes for the email service. When the user
   * types their email address, the URL field is auto-filled with the
   * provider's webmail URL — but only if the user hasn't manually
   * entered a URL themselves.
   * @param {string} serviceId
   * @param {string} value - The email address being typed.
   */
  const handleEmailUsernameChange = (serviceId, value) => {
    setCredentials((prev) => {
      const cred = prev[serviceId] || {};
      const updated = { ...cred, username: value };
      // Only auto-fill URL if the user hasn't manually set one.
      if (!cred.urlManuallySet) {
        const url = lookupEmailUrl(value);
        if (url) {
          updated.url = url;
        } else if (!cred.urlManuallySet) {
          // Clear auto-filled URL if domain is no longer recognised,
          // but only if we were the ones who set it.
          updated.url = '';
        }
      }
      return { ...prev, [serviceId]: updated };
    });
  };

  /**
   * Handles manual URL changes — marks the URL as manually set so the
   * email auto-fill logic won't overwrite it.
   * @param {string} serviceId
   * @param {string} value
   */
  const handleUrlChange = (serviceId, value) => {
    setCredentials((prev) => ({
      ...prev,
      [serviceId]: {
        ...prev[serviceId],
        url: value,
        urlManuallySet: true,
      },
    }));
  };

  const handleCollectNext = () => {
    if (isLastCategory) {
      setPhase('review');
    } else {
      setCatIndex((i) => i + 1);
    }
  };

  // --- Review phase ----------------------------------------------------
  const allAccounts = collectAccounts(selectedServices, credentials);

  const handleReviewSubmit = () => {
    setPhase('submit');
    setSubmitProgress(0);
    setSubmitErrors([]);
    hasStartedSaveRef.current = false;
  };

  // --- Submit phase (auto mode) ----------------------------------------
  const handleAutoSubmit = async () => {
    const accounts = collectAccounts(selectedServices, credentials);
    const errors = [];

    for (let i = 0; i < accounts.length; i++) {
      const acct = accounts[i];
      setSubmitStatus(`${i + 1} of ${accounts.length}: uploading ${acct.name}`);
      try {
        const result = await window.appRuntime?.bitwardenSave({
          name: acct.name,
          username: acct.username,
          password: acct.password,
          url: acct.url,
          ios: acct.ios,
          android: acct.android,
          notes: acct.notes,
        });
        if (!result?.success) {
          errors.push(`${acct.name}: ${result?.error || 'Failed'}`);
        }
      } catch (err) {
        errors.push(`${acct.name}: ${err.message}`);
      }
      setSubmitProgress(Math.round(((i + 1) / accounts.length) * 100));
    }

    setSubmitErrors(errors);
    setSubmitStatus(errors.length > 0
      ? `Done with ${errors.length} error(s).`
      : 'All accounts saved successfully!');
    setPhase('done');
  };

  // Kick off the auto-save when entering the submit phase. The ref
  // prevents multiple calls caused by re-renders during the async loop.
  useEffect(() => {
    if (phase === 'submit' && isAutoMode && !hasStartedSaveRef.current) {
      hasStartedSaveRef.current = true;
      handleAutoSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isAutoMode]);

  // --- Submit phase (manual mode) --------------------------------------
  const handleManualDownload = async () => {
    const accounts = collectAccounts(selectedServices, credentials);
    try {
      const content = generateImportFile(importFormat, accounts);
      const fmt = IMPORT_FORMATS.find((f) => f.id === importFormat);
      const defaultName = `digital-healthcheck-import.${fmt.extension}`;

      if (window.appRuntime?.saveFile) {
        const result = await window.appRuntime.saveFile({
          defaultName,
          content,
        });
        if (result?.saved) {
          setDownloadPath(result.path);
          setSubmitStatus('File saved successfully!');
          setPhase('import-instructions');
          // Open the password manager's website in the system browser.
          const fmt2 = IMPORT_FORMATS.find((f) => f.id === importFormat);
          if (fmt2?.websiteUrl && window.appRuntime?.openExternal) {
            window.appRuntime.openExternal(fmt2.websiteUrl);
          }
        } else if (result?.error) {
          setSubmitStatus(`Error: ${result.error}`);
        }
      }
    } catch (err) {
      setSubmitStatus(`Error: ${err.message}`);
    }
  };

  // --- Import instructions phase (manual mode) -------------------------
  const handleOpenWebsite = () => {
    const fmt = IMPORT_FORMATS.find((f) => f.id === importFormat);
    if (fmt?.websiteUrl && window.appRuntime?.openExternal) {
      window.appRuntime.openExternal(fmt.websiteUrl);
    }
  };

  // ====================================================================
  // Render: Import instructions phase (manual mode)
  // ====================================================================
  if (phase === 'import-instructions') {
    const fmt = IMPORT_FORMATS.find((f) => f.id === importFormat);
    return (
      <section className="page page-centred" aria-labelledby="import-heading">
        <div className="page-body page-body-centred">
          <div className="content-card checker-card">
            <h1 id="import-heading" className="h3 page-heading">
              Import your accounts
            </h1>
            <p className="intro-paragraph">
              We have opened {fmt?.label} in your browser. Follow these
              steps to import your file before continuing:
            </p>

            {fmt?.importSteps && (
              <ol className="import-steps">
                {fmt.importSteps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            )}

            <p className="intro-paragraph mt-3">
              Once you have imported the file, continue below. The file
              will be deleted when you close the app.
            </p>

            <div className="page-footer">
              <NavButton
                label="Open website again"
                variant="outline-secondary"
                onClick={handleOpenWebsite}
              />
              <NavButton
                label="I have imported — continue"
                onClick={() => setPhase('done')}
              />
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ====================================================================
  // Render: Done phase — summary, invite user to close
  // ====================================================================
  if (phase === 'done') {
    const accounts = collectAccounts(selectedServices, credentials);
    const errorCount = submitErrors.length;

    // Build a per-category summary.
    const categorySummary = ACCOUNT_CATEGORIES.map((cat) => {
      const count = accounts.filter((a) => a.category === cat.name).length;
      return { name: cat.name, count };
    }).filter((c) => c.count > 0);

    return (
      <section className="page page-centred" aria-labelledby="done-heading">
        <div className="page-body page-body-centred">
          <div className="content-card">
            <h1 id="done-heading" className="h3 page-heading">
              All done
            </h1>

            <p className="intro-paragraph">
              {isAutoMode
                ? `Successfully saved ${accounts.length} account(s) to your Bitwarden vault.`
                : `Successfully exported ${accounts.length} account(s) to your import file.`}
            </p>

            {categorySummary.length > 0 && (
              <div className="review-list">
                {categorySummary.map((cat) => (
                  <div key={cat.name} className="review-category">
                    <p className="intro-subheading">{cat.name}</p>
                    <div className="review-item">
                      <span className="review-item-name">
                        {cat.count} account{cat.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {errorCount > 0 && (
              <p className="intro-paragraph" style={{ color: '#dc3545' }}>
                {errorCount} account(s) could not be saved. You may want
                to check your Bitwarden vault and add them manually.
              </p>
            )}

            <p className="intro-paragraph mt-3">
              You can now close the app to finish. All data entered into
              this application — including any files created and all
              account information held in memory — will be permanently
              deleted.
            </p>

            <div className="page-footer">
              <NavButton
                label="Close app"
                onClick={requestClose}
              />
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ====================================================================
  // Render: Submit phase (auto mode — saving to Bitwarden)
  // ====================================================================
  if (phase === 'submit' && isAutoMode) {
    // The save is kicked off by the useEffect above when entering this phase.

    return (
      <section className="page page-centred" aria-labelledby="saving-heading">
        <div className="page-body page-body-centred">
          <div className="content-card">
            <h1 id="saving-heading" className="h3 page-heading">
              Saving to Bitwarden
            </h1>
            <ProgressBar now={submitProgress} className="strength-bar mt-3" />
            <p className="strength-checking mt-2">{submitStatus}</p>
            {submitErrors.length > 0 && (
              <div className="mt-2">
                {submitErrors.map((err, i) => (
                  <p key={i} className="text-danger" style={{ fontSize: '0.8rem' }}>
                    {err}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  // ====================================================================
  // Render: Submit phase (manual mode — format selection + download)
  // ====================================================================
  if (phase === 'submit' && !isAutoMode) {
    return (
      <section className="page page-centred" aria-labelledby="format-heading">
        <div className="page-body page-body-centred">
          <div className="content-card">
            <h1 id="format-heading" className="h3 page-heading">
              Download your import file
            </h1>
            <p className="intro-paragraph">
              Choose your password manager and we will generate an import
              file with all {allAccounts.length} account(s) you entered.
            </p>
            <Form.Group className="mt-3" controlId="import-format">
              <Form.Select
                value={importFormat}
                onChange={(e) => setImportFormat(e.target.value)}
                aria-label="Import format"
              >
                {IMPORT_FORMATS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            {submitStatus && (
              <p className="mt-3" role="status">{submitStatus}</p>
            )}
            <div className="page-footer">
              <NavButton
                label="Back"
                variant="outline-secondary"
                onClick={() => setPhase('review')}
              />
              <NavButton label="Download" onClick={handleManualDownload} />
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ====================================================================
  // Render: Review phase
  // ====================================================================
  if (phase === 'review') {
    return (
      <section className="page page-centred" aria-labelledby="review-heading">
        <div className="page-body page-body-centred">
          <div className="content-card checker-card">
            <h1 id="review-heading" className="h3 page-heading">
              Review your accounts
            </h1>
            <p className="intro-paragraph">
              {allAccounts.length} account(s) ready to{' '}
              {isAutoMode ? 'save to Bitwarden' : 'export'}.
            </p>

            {allAccounts.length === 0 ? (
              <p className="intro-paragraph">
                No accounts selected. Go back and select the services you use.
              </p>
            ) : (
              <div className="review-list">
                {ACCOUNT_CATEGORIES.map((cat) => {
                  const catAccounts = allAccounts.filter(
                    (a) => a.category === cat.name,
                  );
                  if (catAccounts.length === 0) return null;
                  return (
                    <div key={cat.id} className="review-category">
                      <p className="intro-subheading">{cat.name}</p>
                      {catAccounts.map((acct) => (
                        <div key={acct.id} className="review-item">
                          <span className="review-item-name">{acct.name}</span>
                          <span className="review-item-detail">
                            {acct.username || '—'}
                          </span>
                          <span className="review-item-detail">
                            {acct.password ? '✓' : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="page-footer">
              <NavButton
                label="Back"
                variant="outline-secondary"
                onClick={() => setPhase('collect')}
              />
              <NavButton
                label={isAutoMode ? 'Save to Bitwarden' : 'Generate Import File'}
                disabled={allAccounts.length === 0}
                onClick={handleReviewSubmit}
              />
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ====================================================================
  // Render: Collect phase (default — category-by-category entry)
  // ====================================================================
  const selectedCount = category.services.filter(
    (s) => selectedServices[s.id],
  ).length;

  return (
    <section className="page page-centred" aria-labelledby="cat-heading">
      <div className="page-body page-body-centred">
        <div className="content-card checker-card">
          <h1 id="cat-heading" className="h3 page-heading">
            {category.name}
          </h1>
          <p className="intro-paragraph">{category.description}</p>

          <p className="intro-subheading">Which do you use?</p>
          <div className="mode-options">
            {category.services.map((svc) => (
              <button
                key={svc.id}
                type="button"
                className={`mode-option${selectedServices[svc.id] ? ' selected' : ''}`}
                onClick={() => toggleService(svc.id)}
                aria-pressed={selectedServices[svc.id]}
              >
                <span className="mode-option-title">{svc.name}</span>
              </button>
            ))}
          </div>

          {selectedCount > 0 && (
            <div className="credential-forms">
              <p className="intro-subheading mt-3">
                Enter your details ({selectedCount} selected)
              </p>
              {category.services.filter((s) => selectedServices[s.id]).map((svc) => {
                const cred = credentials[svc.id] || {};
                const isEmailService = svc.id === 'email';
                return (
                  <div key={svc.id} className="credential-form">
                    <p className="credential-form-title">{svc.name}</p>
                    {svc.customUrl && (
                      <Form.Control
                        className="mb-2"
                        type="url"
                        placeholder="Website URL"
                        value={cred.url || ''}
                        onChange={(e) => handleUrlChange(svc.id, e.target.value)}
                        aria-label={`${svc.name} URL`}
                      />
                    )}
                    <Form.Control
                      className="mb-2"
                      type="text"
                      placeholder="Username or email"
                      value={cred.username || ''}
                      onChange={(e) =>
                        isEmailService
                          ? handleEmailUsernameChange(svc.id, e.target.value)
                          : updateCredential(svc.id, 'username', e.target.value)
                      }
                      aria-label={`${svc.name} username`}
                      autoComplete="off"
                    />
                    <InputGroup className="mb-2">
                      <Form.Control
                        type={cred.showPassword ? 'text' : 'password'}
                        placeholder="Password"
                        value={cred.password || ''}
                        onChange={(e) => updateCredential(svc.id, 'password', e.target.value)}
                        aria-label={`${svc.name} password`}
                        autoComplete="off"
                      />
                      <NavButton
                        label={cred.showPassword ? 'Hide' : 'Show'}
                        variant="outline-secondary"
                        onClick={() => updateCredential(svc.id, 'showPassword', !cred.showPassword)}
                      />
                    </InputGroup>
                  </div>
                );
              })}
            </div>
          )}

          <div className="page-footer">
            {onBack && (
              <NavButton
                label="Back"
                variant="outline-secondary"
                onClick={catIndex === 0 ? onBack : () => setCatIndex((i) => i - 1)}
              />
            )}
            <NavButton
              label={isLastCategory ? 'Review' : 'Continue'}
              onClick={handleCollectNext}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
