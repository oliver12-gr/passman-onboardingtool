import { NavButton } from '../components/nav-button.jsx';

/**
 * Renders a single static-content intro page with centred text
 * (horizontally and vertically). Supports multiple paragraphs with
 * spacing, and optional sections with sub-headings and bullet lists.
 * Content and buttons sit inside a semi-transparent card.
 *
 * @param {object} props
 * @param {object} props.page - A content entry from intro-content.js.
 * @param {function} props.onNext - Advance to the next page.
 * @param {function} [props.onBack] - Return to the previous page.
 * @param {boolean} [props.isLast] - Hides the Next button when true.
 */
export function IntroPage({ page, onNext, onBack, isLast }) {
  return (
    <section className="page text-center page-centred" aria-labelledby="intro-heading">
      <div className="page-body page-body-centred">
        <div className="content-card">
          <h1 id="intro-heading" className="h3 page-heading">
            {page.heading}
          </h1>
          {page.paragraphs?.map((para, i) => (
            <p key={i} className="intro-paragraph">
              {para}
            </p>
          ))}
          {page.sections?.map((section, i) => (
            <div key={i} className="intro-section">
              <p className="intro-subheading">{section.subHeading}</p>
              <ul className="intro-bullets">
                {section.bullets.map((bullet, j) => (
                  <li key={j}>{bullet}</li>
                ))}
              </ul>
            </div>
          ))}
          <div className="page-footer">
            {onBack && (
              <NavButton label="Back" variant="outline-secondary" onClick={onBack} />
            )}
            {!isLast && <NavButton label="Next" onClick={onNext} />}
          </div>
        </div>
      </div>
    </section>
  );
}
