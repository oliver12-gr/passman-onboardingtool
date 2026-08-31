import { createContext, useCallback, useContext, useState } from 'react';
import { ProgressBar } from 'react-bootstrap';
import { NavButton } from '../components/nav-button.jsx';

/**
 * Provides a global cleanup mechanism. When the user clicks the X button
 * (or the final "Delete then close" button), a warning dialog appears
 * followed by a loading animation that clears all data and quits the app.
 *
 * The actual data clearing is delegated to a callback registered by the
 * account collection page (which holds the credentials state). This
 * ensures all entered data is wiped before the app closes.
 */

const CleanupContext = createContext(null);

/**
 * Hook to access the cleanup context.
 * @returns {object} The cleanup API.
 */
export function useCleanup() {
  return useContext(CleanupContext);
}

/**
 * Registers a data-clearing function. Called during cleanup to wipe
 * credentials from memory. The account collection page registers this.
 *
 * @param {function} clearFn
 */
export function useRegisterCleanup(clearFn) {
  const ctx = useContext(CleanupContext);
  if (ctx) {
    ctx.registerClear(clearFn);
  }
}

export function CleanupProvider({ children }) {
  const [showWarning, setShowWarning] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanupProgress, setCleanupProgress] = useState(0);
  const [cleanupStatus, setCleanupStatus] = useState('');
  const [clearFn, setClearFn] = useState(null);
  const [filesToDelete, setFilesToDelete] = useState([]);

  const registerClear = useCallback((fn) => {
    setClearFn(() => fn);
  }, []);

  const requestClose = useCallback(() => {
    setShowWarning(true);
  }, []);

  const performCleanup = useCallback(async () => {
    setIsCleaning(true);
    const steps = [
      'Clearing entered credentials...',
      'Removing temporary files...',
      'Uninstalling Bitwarden CLI...',
      'Wiping memory...',
    ];

    for (let i = 0; i < steps.length; i++) {
      setCleanupStatus(steps[i]);
      setCleanupProgress(Math.round(((i + 1) / steps.length) * 100));
      await new Promise((r) => setTimeout(r, 500));
    }

    // Clear all registered data.
    if (clearFn) clearFn();

    // Delete any registered files.
    for (const filePath of filesToDelete) {
      if (filePath && window.appRuntime?.deleteFile) {
        await window.appRuntime.deleteFile(filePath);
      }
    }

    // Remove the temp-installed Bitwarden CLI.
    if (window.appRuntime?.cleanupCli) {
      await window.appRuntime.cleanupCli();
    }

    // Close the app.
    if (window.appRuntime?.quit) {
      window.appRuntime.quit();
    }
  }, [clearFn, filesToDelete]);

  const registerFile = useCallback((filePath) => {
    setFilesToDelete((prev) => (filePath && !prev.includes(filePath)
      ? [...prev, filePath]
      : prev));
  }, []);

  const value = {
    requestClose,
    registerClear,
    registerFile,
  };

  return (
    <CleanupContext.Provider value={value}>
      {children}
      {showWarning && (
        <div className="cleanup-overlay" role="dialog" aria-modal="true">
          <div className="content-card cleanup-dialog">
            <h1 className="h3 page-heading">Before you go</h1>
            <p className="intro-paragraph">
              Before closing, all data entered into this application will
              be permanently deleted. This includes any copies of files
              created and all account information held in memory.
            </p>
            <p className="intro-paragraph">
              This action cannot be undone.
            </p>

            {isCleaning && (
              <>
                <ProgressBar
                  now={cleanupProgress}
                  className={`strength-bar mt-3${cleanupProgress >= 100 ? ' progress-bar-complete' : ''}`}
                />
                <p className="strength-checking mt-2">{cleanupStatus}</p>
              </>
            )}

            {!isCleaning && (
              <div className="page-footer">
                <NavButton
                  label="Cancel"
                  variant="outline-secondary"
                  onClick={() => setShowWarning(false)}
                />
                <NavButton
                  label="Delete then close"
                  onClick={performCleanup}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </CleanupContext.Provider>
  );
}
