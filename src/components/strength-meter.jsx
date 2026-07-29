import { ProgressBar } from 'react-bootstrap';
import { estimateTimeToCrack } from '../scripts/time-to-crack.js';

/**
 * Visual strength meter. Colour is never the sole indicator — a text
 * label always accompanies the bar, and the verdict is announced to
 * assistive tech via aria-live.
 *
 * While the dictionary is loading, shows an animated "checking..." with
 * cycling dots as a loading distraction.
 *
 * When results are ready, shows three bold lines (same size as the
 * description text):
 *   Strength: [verdict]
 *   Time to crack: [duration]
 *   Entropy: ~[bits] bits
 * followed by the actionable suggestion below.
 *
 * @param {object} props
 * @param {object|null} props.verdict - A VERDICTS entry, or null when empty.
 * @param {number} props.entropyBits
 * @param {string} props.suggestion
 * @param {boolean} props.checking - True while the dictionary is loading.
 */
export function StrengthMeter({ verdict, entropyBits, suggestion, checking }) {
  if (checking) {
    return (
      <div className="strength-meter" aria-live="polite">
        <ProgressBar now={100} animated className="strength-bar" />
        <div className="strength-checking">Checking<span className="checking-dots"><span>.</span><span>.</span><span>.</span></span></div>
      </div>
    );
  }

  if (!verdict) {
    return (
      <div className="strength-meter" aria-live="polite">
        <ProgressBar now={0} className="strength-bar" />
      </div>
    );
  }

  const now = verdict.score * 20;
  const { label: timeLabel } = estimateTimeToCrack(entropyBits);

  return (
    <div className="strength-meter" aria-live="polite">
      <ProgressBar
        now={now}
        variant={verdict.variant}
        className="strength-bar"
        aria-label={`Password strength: ${verdict.label}`}
      />
      <div className="strength-results">
        <div className="strength-line">
          <strong>Strength:</strong> {verdict.label}
        </div>
        <div className="strength-line">
          <strong>Time to crack:</strong> {timeLabel}
        </div>
        <div className="strength-line">
          <strong>Entropy:</strong> ~{entropyBits} bits
        </div>
        {suggestion && (
          <div className="strength-suggestion">{suggestion}</div>
        )}
      </div>
    </div>
  );
}
