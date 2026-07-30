import { useEffect, useRef, useState } from 'react';
import { Form, InputGroup, ProgressBar } from 'react-bootstrap';
import { NavButton } from '../components/nav-button.jsx';
import { ACCOUNT_CATEGORIES, IMPORT_FORMATS } from '../content/account-content.js';
import { generateImportFile } from '../scripts/import-generator.js';
import { useCleanup } from '../app/cleanup-context.jsx';

/**
 * Inline SVG icons for essential service selection cards.
 * Social media and subscription services use favicons instead.
 */
const SERVICE_ICONS = {
  envelope: (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 7l10 7 10-7" />
    </svg>
  ),
  money: (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6v12" />
      <path d="M15 9.5c0-1.4-1.3-2.5-3-2.5s-3 1.1-3 2.5 1.3 2.5 3 2.5 3 1.1 3 2.5-1.3 2.5-3 2.5-3-1.1-3-2.5" />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </svg>
  ),
};

/**
 * Builds a local favicon path for a service. Favicons are bundled in
 * public/favicons/ so the app works fully offline.
 * @param {string} serviceId - The service's unique ID.
 * @returns {string} A relative path to the favicon image.
 */
function faviconPath(serviceId) {
  return `./favicons/${serviceId}.png`;
}

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
 * @param {object[]} [customAccounts] - User-added custom accounts.
 * @returns {object[]}
 */
function collectAccounts(selectedServices, credentials, customAccounts = []) {
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

  // Add custom user-added accounts.
  for (const acct of customAccounts) {
    accounts.push({
      id: acct.id,
      name: acct.name || 'Custom account',
      username: acct.username || '',
      password: acct.password || '',
      url: acct.url || '',
      ios: '',
      android: '',
      notes: '',
      category: 'Other',
    });
  }

  return accounts;
}

export function AccountCollectionPage({ mode, bitwardenConnected, onBack, onSubProgress }) {
  // Flow phases: 'collect' → 'custom-accounts' → 'review' → 'submit' → 'import-instructions' → 'done'
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
  // Index within the current category's selected services for pagination.
  const [credIndex, setCredIndex] = useState(0);
  // Custom user-added accounts.
  const [customAccounts, setCustomAccounts] = useState([]);
  // Index for paginating through custom accounts.
  const [customIndex, setCustomIndex] = useState(0);

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
        setCustomAccounts([]);
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
  // The collection phases are the bulk of the user's work, so they
  // are weighted to fill ~70% of the bar. The remaining phases share
  // the last 30%.
  const numCategories = ACCOUNT_CATEGORIES.length;

  useEffect(() => {
    let progress = 0;
    if (phase === 'collect') {
      // Spread categories across 0%–60%.
      progress = (catIndex / numCategories) * 0.6;
    } else if (phase === 'custom-accounts') {
      progress = 0.7;
    } else if (phase === 'review') {
      progress = 0.8;
    } else if (phase === 'submit') {
      progress = 0.88;
    } else if (phase === 'import-instructions') {
      progress = 0.94;
    } else if (phase === 'done') {
      progress = 1; // 100%
    }
    if (onSubProgress) {
      onSubProgress(progress);
    }
  }, [phase, catIndex, numCategories, onSubProgress]);

  const isLastCategory = catIndex === ACCOUNT_CATEGORIES.length - 1;

  const toggleService = (serviceId) => {
    setSelectedServices((prev) => ({
      ...prev,
      [serviceId]: !prev[serviceId],
    }));
    // Reset credential pagination index when selection changes.
    setCredIndex(0);
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
      setPhase('custom-accounts');
      setCustomIndex(0);
    } else {
      setCatIndex((i) => i + 1);
      setCredIndex(0);
    }
  };

  // --- Review phase ----------------------------------------------------
  const allAccounts = collectAccounts(selectedServices, credentials, customAccounts);

  const handleReviewSubmit = () => {
    setPhase('submit');
    setSubmitProgress(0);
    setSubmitErrors([]);
    hasStartedSaveRef.current = false;
  };

  // --- Submit phase (auto mode) ----------------------------------------
  const handleAutoSubmit = async () => {
    const accounts = collectAccounts(selectedServices, credentials, customAccounts);
    const errors = [];

    for (let i = 0; i < accounts.length; i++) {
      const acct = accounts[i];
      // Set progress to just past the previous account so the bar isn't
      // empty while uploading (e.g. account 2 of 3 → 33%).
      setSubmitProgress(Math.round((i / accounts.length) * 100));
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
    const accounts = collectAccounts(selectedServices, credentials, customAccounts);
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
    const accounts = collectAccounts(selectedServices, credentials, customAccounts);
    const errorCount = submitErrors.length;

    // Build a per-category summary.
    const categorySummary = [
      ...ACCOUNT_CATEGORIES.map((cat) => ({
        name: cat.name,
        count: accounts.filter((a) => a.category === cat.name).length,
      })),
      { name: 'Other', count: accounts.filter((a) => a.category === 'Other').length },
    ].filter((c) => c.count > 0);

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
    const isUploading = submitProgress < 100;

    return (
      <section className="page page-centred" aria-labelledby="saving-heading">
        <div className="page-body page-body-centred">
          <div className="content-card">
            <h1 id="saving-heading" className="h3 page-heading">
              Saving to Bitwarden
            </h1>
            <ProgressBar
              now={submitProgress}
              animated={isUploading}
              className="strength-bar mt-3"
            />
            <p className="strength-checking mt-2">
              {submitStatus}
              {isUploading && <span className="uploading-dots" />}
            </p>
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
  // Render: Custom accounts phase — add any other accounts
  // ====================================================================
  if (phase === 'custom-accounts') {
    const currentCustom = customAccounts[customIndex];
    const customCount = customAccounts.length;
    const isLastCustom = customIndex === customCount - 1;

    const addCustomAccount = () => {
      // If the current card is blank, stay on it instead of adding
      // a new blank one.
      if (currentCustom
          && !currentCustom.name
          && !currentCustom.url
          && !currentCustom.username
          && !currentCustom.password) {
        return;
      }
      setCustomAccounts((prev) => [...prev, {
        id: `custom-${Date.now()}`,
        name: '',
        url: '',
        username: '',
        password: '',
        showPassword: false,
      }]);
      setCustomIndex(customAccounts.length); // move to the new (blank) one
    };

    const removeCustomAccount = (idx) => {
      setCustomAccounts((prev) => prev.filter((_, i) => i !== idx));
      // Adjust index if needed.
      if (idx <= customIndex && customIndex > 0) {
        setCustomIndex((i) => Math.max(0, i - 1));
      }
    };

    const updateCustomAccount = (idx, field, value) => {
      setCustomAccounts((prev) => prev.map((a, i) =>
        i === idx ? { ...a, [field]: value } : a
      ));
    };

    const handleCustomNext = () => {
      if (customCount > 0 && !isLastCustom) {
        setCustomIndex((i) => i + 1);
      } else {
        setPhase('review');
      }
    };

    const handleCustomBack = () => {
      if (customIndex > 0) {
        setCustomIndex((i) => i - 1);
      } else {
        // Go back to the last category (subscriptions).
        setPhase('collect');
        setCatIndex(ACCOUNT_CATEGORIES.length - 1);
        const lastCat = ACCOUNT_CATEGORIES[ACCOUNT_CATEGORIES.length - 1];
        const lastSelected = lastCat.services.filter((s) => selectedServices[s.id]);
        setCredIndex(Math.max(0, lastSelected.length - 1));
      }
    };

    return (
      <section className="page page-centred" aria-labelledby="custom-heading">
        <div className="page-body page-body-centred">
          <div className="content-card checker-card">
            <h1 id="custom-heading" className="h3 page-heading">
              Would you like to add any other accounts?
            </h1>
            <p className="intro-paragraph">
              Add any accounts that weren&apos;t listed in the previous steps.
              You can add as many as you like, or skip this step.
            </p>

            {customCount > 0 && currentCustom && (
              <div className="credential-forms">
                <p className="intro-subheading mt-3">
                  Enter your details ({customIndex + 1} of {customCount} added)
                </p>
                <div className="credential-form custom-credential-form">
                  <button
                    type="button"
                    className="custom-remove-btn"
                    onClick={() => removeCustomAccount(customIndex)}
                    aria-label="Remove this account"
                    title="Remove"
                  >
                    &#10005;
                  </button>
                  <Form.Control
                    className="mb-2"
                    type="text"
                    placeholder="Name (e.g. My Bank, Gym membership)"
                    value={currentCustom.name || ''}
                    onChange={(e) => updateCustomAccount(customIndex, 'name', e.target.value)}
                    aria-label="Account name"
                    autoComplete="off"
                  />
                  <Form.Control
                    className="mb-2"
                    type="url"
                    placeholder="Website URL"
                    value={currentCustom.url || ''}
                    onChange={(e) => updateCustomAccount(customIndex, 'url', e.target.value)}
                    aria-label="Website URL"
                  />
                  <Form.Control
                    className="mb-2"
                    type="text"
                    placeholder="Username or email"
                    value={currentCustom.username || ''}
                    onChange={(e) => updateCustomAccount(customIndex, 'username', e.target.value)}
                    aria-label="Username or email"
                    autoComplete="off"
                  />
                  <InputGroup className="mb-2">
                    <Form.Control
                      type={currentCustom.showPassword ? 'text' : 'password'}
                      placeholder="Password"
                      value={currentCustom.password || ''}
                      onChange={(e) => updateCustomAccount(customIndex, 'password', e.target.value)}
                      aria-label="Password"
                      autoComplete="off"
                    />
                    <NavButton
                      label={currentCustom.showPassword ? 'Hide' : 'Show'}
                      variant="outline-secondary"
                      onClick={() => updateCustomAccount(customIndex, 'showPassword', !currentCustom.showPassword)}
                    />
                  </InputGroup>
                </div>
              </div>
            )}

            <div className="page-footer">
              <NavButton
                label="Back"
                variant="outline-secondary"
                onClick={handleCustomBack}
              />
              <NavButton
                label="Add more"
                variant="outline-secondary"
                onClick={addCustomAccount}
              />
              <NavButton
                label={customCount > 0 && !isLastCustom ? 'Next' : 'Review'}
                onClick={handleCustomNext}
              />
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
    const otherAccounts = allAccounts.filter((a) => a.category === 'Other');

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
                {otherAccounts.length > 0 && (
                  <div key="other" className="review-category">
                    <p className="intro-subheading">Other</p>
                    {otherAccounts.map((acct) => (
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
                )}
              </div>
            )}

            <div className="page-footer">
              <NavButton
                label="Back"
                variant="outline-secondary"
                onClick={() => setPhase('custom-accounts')}
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
  const selectedInCategory = category.services.filter(
    (s) => selectedServices[s.id],
  );
  const selectedCount = selectedInCategory.length;

  // Clamp credIndex in case a service was deselected.
  const effectiveCredIndex = Math.min(credIndex, Math.max(0, selectedCount - 1));
  const currentSvc = selectedInCategory[effectiveCredIndex];
  const isLastCred = effectiveCredIndex === selectedCount - 1;
  // The bottom button says "Next" while there are more credentials to
  // fill in, "Continue" on the last credential of a non-final category.
  // The last category now goes to custom-accounts, so it also says "Next".
  const bottomButtonLabel = selectedCount === 0
    ? (isLastCategory ? 'Next' : 'Continue')
    : (isLastCred
        ? (isLastCategory ? 'Next' : 'Continue')
        : 'Next');

  const handleBottomButton = () => {
    if (selectedCount > 0 && !isLastCred) {
      // Still more credentials in this category — advance to next.
      setCredIndex((i) => i + 1);
    } else {
      // All credentials done (or none selected) — next category or review.
      handleCollectNext();
    }
  };

  const handleCredBack = () => {
    if (effectiveCredIndex > 0) {
      setCredIndex((i) => i - 1);
    } else if (catIndex > 0) {
      // Go back to previous category.
      setCatIndex((i) => i - 1);
      // Set credIndex to last credential of previous category.
      const prevCat = ACCOUNT_CATEGORIES[catIndex - 1];
      const prevSelected = prevCat.services.filter((s) => selectedServices[s.id]);
      setCredIndex(Math.max(0, prevSelected.length - 1));
    } else if (onBack) {
      onBack();
    }
  };

  return (
    <section className="page page-centred" aria-labelledby="cat-heading">
      <div className="page-body page-body-centred">
        <div className="content-card checker-card">
          <h1 id="cat-heading" className="h3 page-heading">
            {category.name}
          </h1>
          <p className="intro-paragraph">{category.description}</p>

          <p className="intro-subheading">Which do you use?</p>
          {(() => {
            const hasIcons = category.services.some((s) => s.icon || s.favicon);
            const isCompact = hasIcons && category.services.length > 3;
            const containerCls = hasIcons
              ? `mode-options${isCompact ? ' compact' : ''}`
              : 'service-options';
            return (
              <div className={containerCls}>
                {category.services.map((svc) => {
                  const hasIcon = !!svc.icon;
                  const hasFavicon = !!svc.favicon;
                  const containerClass = (hasIcon || hasFavicon)
                    ? `mode-option${isCompact ? ' compact' : ''}`
                    : 'service-option';
                  const titleClass = (hasIcon || hasFavicon)
                    ? 'mode-option-title'
                    : 'service-option-title';
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      className={`${containerClass}${selectedServices[svc.id] ? ' selected' : ''}`}
                      onClick={() => toggleService(svc.id)}
                      aria-pressed={selectedServices[svc.id]}
                    >
                      {hasIcon && (
                        <span className="mode-option-icon">
                          {SERVICE_ICONS[svc.icon] || null}
                        </span>
                      )}
                      {hasFavicon && (
                        <span className="mode-option-icon">
                          <img
                            src={faviconPath(svc.id)}
                            alt=""
                            width="28"
                            height="28"
                            className="favicon-img"
                          />
                        </span>
                      )}
                      <span className={titleClass}>{svc.name}</span>
                    </button>
                  );
                })}
              </div>
            );
          })()}


          {selectedCount > 0 && currentSvc && (
            <div className="credential-forms">
              <p className="intro-subheading mt-3">
                Enter your details ({effectiveCredIndex + 1} of {selectedCount} selected)
              </p>
              {(() => {
                const svc = currentSvc;
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
              })()}
            </div>
          )}

          <div className="page-footer">
            {onBack && (
              <NavButton
                label="Back"
                variant="outline-secondary"
                onClick={handleCredBack}
              />
            )}
            <NavButton
              label={bottomButtonLabel}
              onClick={handleBottomButton}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
