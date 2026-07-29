import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppContext } from '../../src/app/app-context.jsx';
import { ProgressBarTop } from '../../src/components/progress-bar.jsx';

function renderWithProgress(progress) {
  return render(
    <AppContext.Provider value={{ progress }}>
      <ProgressBarTop />
    </AppContext.Provider>,
  );
}

describe('ProgressBarTop', () => {
  it('renders the current progress value', () => {
    renderWithProgress(40);
    expect(screen.getByText('40%')).toBeInTheDocument();
  });

  it('exposes an aria-label describing the progress', () => {
    renderWithProgress(60);
    expect(
      screen.getByLabelText(/Digital Healthcheck progress: 60%/),
    ).toBeInTheDocument();
  });

  it('clamps nothing itself — just displays what context provides', () => {
    renderWithProgress(0);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});
