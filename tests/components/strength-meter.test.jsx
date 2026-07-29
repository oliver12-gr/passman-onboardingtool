import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StrengthMeter } from '../../src/components/strength-meter.jsx';
import { VERDICTS } from '../../src/scripts/strength-evaluator.js';

describe('StrengthMeter', () => {
  it('renders nothing meaningful when verdict is null', () => {
    const { container } = render(
      <StrengthMeter verdict={null} entropyBits={0} suggestion="" />,
    );
    expect(screen.queryByText(/weak|strong|fair/i)).toBeNull();
    expect(container.querySelector('.strength-bar')).toBeInTheDocument();
    expect(container.querySelector('.strength-results')).toBeNull();
  });

  it('renders the verdict, time to crack, and entropy as separate lines', () => {
    const { container } = render(
      <StrengthMeter
        verdict={VERDICTS.STRONG}
        entropyBits={72}
        suggestion="~72 bits of entropy. Strong."
      />,
    );
    // Three separate strength lines.
    const lines = container.querySelectorAll('.strength-line');
    expect(lines).toHaveLength(3);
    expect(lines[0].textContent).toContain('Strength:');
    expect(lines[0].textContent).toContain('Strong');
    expect(lines[1].textContent).toContain('Time to crack:');
    expect(lines[2].textContent).toContain('Entropy:');
    expect(lines[2].textContent).toContain('~72 bits');
    // The suggestion is rendered below the lines.
    expect(screen.getByText('~72 bits of entropy. Strong.')).toBeInTheDocument();
  });

  it('shows checking indicator when checking is true', () => {
    const { container } = render(
      <StrengthMeter verdict={null} entropyBits={0} suggestion="" checking />,
    );
    expect(container.querySelector('.strength-checking')).toBeInTheDocument();
    expect(screen.getByText(/Checking/)).toBeInTheDocument();
  });

  it('exposes an aria-live region for screen readers', () => {
    const { container } = render(
      <StrengthMeter
        verdict={VERDICTS.WEAK}
        entropyBits={20}
        suggestion="Too short."
      />,
    );
    const live = container.querySelector('[aria-live]');
    expect(live).toHaveAttribute('aria-live', 'polite');
  });
});
