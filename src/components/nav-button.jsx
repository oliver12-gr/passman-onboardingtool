import { Button } from 'react-bootstrap';

/**
 * Reusable navigation button. Real <button> element for keyboard access.
 *
 * @param {object} props
 * @param {string} props.label - Visible text.
 * @param {function} props.onClick - Click handler.
 * @param {string} [props.variant] - Bootstrap variant.
 * @param {boolean} [props.disabled]
 * @param {string} [props.className]
 */
export function NavButton({
  label,
  onClick,
  variant = 'primary',
  disabled = false,
  className = '',
}) {
  return (
    <Button
      type="button"
      variant={variant}
      onClick={onClick}
      disabled={disabled}
      className={className}
      aria-label={label}
    >
      {label}
    </Button>
  );
}
