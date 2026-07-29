import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NavButton } from '../../src/components/nav-button.jsx';

describe('NavButton', () => {
  it('renders a real button with the label', () => {
    render(<NavButton label="Next" onClick={() => {}} />);
    expect(
      screen.getByRole('button', { name: 'Next' }),
    ).toBeInTheDocument();
  });

  it('fires onClick when activated', () => {
    const onClick = vi.fn();
    render(<NavButton label="Next" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled', () => {
    const onClick = vi.fn();
    render(<NavButton label="Next" onClick={onClick} disabled />);
    const btn = screen.getByRole('button', { name: 'Next' });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });
});
