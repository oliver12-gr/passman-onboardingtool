/**
 * Editable copy and configuration for the onboarding flow pages.
 * Kept separate from components so wording can be reviewed without
 * touching layout code.
 *
 * Steps are rendered in order by OnboardingFlow. Each step has a `kind`
 * that determines which page component renders it.
 */

export const ONBOARDING_STEPS = Object.freeze([
  {
    id: 'mode-select',
    kind: 'mode-select',
    heading: 'Choose your mode',
    subtitle: 'How would you like to proceed?',
    options: [
      {
        id: 'auto',
        title: 'Standard Mode',
        icon: 'key',
      },
      {
        id: 'manual',
        title: 'Manual Mode',
        icon: 'clipboard',
      },
    ],
  },
  {
    id: 'bitwarden-intro',
    kind: 'bitwarden-intro',
    heading: 'Your password manager',
    body: 'There are many great password managers out there, but for this healthcheck we will use Bitwarden — a free, open-source, and audited option.',
    servers: [
      { id: 'us', label: 'US (bitwarden.com)', url: 'https://vault.bitwarden.com' },
      { id: 'eu', label: 'EU (bitwarden.eu)', url: 'https://vault.bitwarden.eu' },
      { id: 'self', label: 'Self-hosted', url: '' },
    ],
    signUpUrl: 'https://bitwarden.com/go/start-free/',
  },
]);
