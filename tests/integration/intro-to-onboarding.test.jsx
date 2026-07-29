import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '../../src/app/app.jsx';
import { __setDictionaryForTests } from '../../src/scripts/dictionary-checker.js';

const DICT = new Set(['password', '123456']);

describe('Intro to onboarding integration', () => {
  beforeEach(() => {
    __setDictionaryForTests(DICT);
  });

  it('walks through welcome + intro pages and transitions to onboarding', async () => {
    render(<App />);

    // Welcome page
    expect(screen.getByText('Welcome.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tell me how' }));

    // Page 1: What is a password manager?
    expect(
      screen.getByText('What is a password manager?'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    // Page 2: Why does it matter?
    expect(screen.getByText('Why does it matter?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    // Page 3: What are the benefits?
    expect(screen.getByText('What are the benefits?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    // Page 4: strength checker
    expect(
      screen.getByText('Is your password any good?'),
    ).toBeInTheDocument();

    // No progress bar should be visible yet.
    expect(screen.queryByLabelText(/Onboarding progress/)).toBeNull();

    // Type a dictionary password and verify it is flagged.
    const input = screen.getByLabelText('Password to check');
    fireEvent.change(input, { target: { value: 'password' } });

    await waitFor(() => {
      expect(screen.getByText('Very weak')).toBeInTheDocument();
    });

    // Get Started transitions to the onboarding phase with a progress bar.
    fireEvent.click(screen.getByRole('button', { name: 'Get Started' }));

    await waitFor(() => {
      // First onboarding step (mode select) — progress should be > 0%.
      expect(
        screen.getByLabelText(/Digital Healthcheck progress/),
      ).toBeInTheDocument();
    });

    // The mode selection page should be visible.
    expect(screen.getByText('Choose your mode')).toBeInTheDocument();

    // The intro screens are no longer reachable.
    expect(screen.queryByText('Welcome.')).toBeNull();
  });
});
