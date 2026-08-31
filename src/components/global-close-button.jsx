import { useCleanup } from '../app/cleanup-context.jsx';

/**
 * Global close (X) button rendered in the top-right corner of the app.
 * Triggers the cleanup flow: warns the user, shows a loading animation
 * that deletes all entered data and cached files, then quits the app.
 *
 * This replaces the native Windows title bar close button.
 */
export function GlobalCloseButton() {
  const { requestClose } = useCleanup();

  return (
    <button
      type="button"
      className="global-close-btn"
      onClick={requestClose}
      aria-label="Close application"
      title="Close"
    >
      &#10005;
    </button>
  );
}
