import { NavButton } from '../components/nav-button.jsx';

/**
 * Welcome screen. Shown before the intro explanation pages.
 * The animated key/padlock background is rendered at the app shell level
 * so it appears on every page.
 *
 * @param {object} props
 * @param {function} props.onNext - Advance to the first explanation page.
 */
export function WelcomePage({ onNext }) {
  return (
    <section className="page welcome-page" aria-labelledby="welcome-heading">
      <div className="content-card welcome-card">
        <h1 id="welcome-heading" className="welcome-title">
          Welcome.
        </h1>
        <h2 className="welcome-subtitle">Time for a digital health check!</h2>
        <p className="welcome-body">
          PassMan is a Password Management Onboarding tool to help you
          better-secure your digital accounts.
        </p>
        <div className="welcome-button">
          <NavButton label="Tell me how" onClick={onNext} />
        </div>
      </div>
    </section>
  );
}
