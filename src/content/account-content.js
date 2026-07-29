/**
 * Account collection configuration. Defines the categories of accounts
 * the app will help the user secure, in priority order, and the known
 * services within each category.
 *
 * Each service includes identifiers for auto-mode (Bitwarden CLI saves
 * the URL and/or iOS/Android app IDs alongside the credentials).
 *
 * Categories are presented to the user one at a time. Within each
 * category, the user can select which services they use and enter
 * credentials for each.
 */

export const ACCOUNT_CATEGORIES = Object.freeze([
  {
    id: 'essential',
    name: 'Essential accounts',
    description: 'Your email, internet banking, and phone provider.',
    services: [
      {
        id: 'email',
        name: 'Email provider',
        placeholder: 'e.g. Gmail, Outlook, ProtonMail',
        url: '',
        ios: '',
        android: '',
        customUrl: true,
      },
      {
        id: 'banking',
        name: 'Internet banking',
        placeholder: 'e.g. Chase, HSBC, NatWest',
        url: '',
        ios: '',
        android: '',
        customUrl: true,
      },
      {
        id: 'phone',
        name: 'Phone provider',
        placeholder: 'e.g. Verizon, EE, Vodafone',
        url: '',
        ios: '',
        android: '',
        customUrl: true,
      },
    ],
  },
  {
    id: 'social',
    name: 'Social media',
    description: 'Your social media accounts.',
    services: [
      {
        id: 'facebook',
        name: 'Facebook',
        url: 'https://facebook.com',
        ios: 'id284882215',
        android: 'com.facebook.katana',
      },
      {
        id: 'instagram',
        name: 'Instagram',
        url: 'https://instagram.com',
        ios: 'id389801252',
        android: 'com.instagram.android',
      },
      {
        id: 'x',
        name: 'X (Twitter)',
        url: 'https://x.com',
        ios: 'id333903271',
        android: 'com.twitter.android',
      },
      {
        id: 'linkedin',
        name: 'LinkedIn',
        url: 'https://linkedin.com',
        ios: 'id288429040',
        android: 'com.linkedin.android',
      },
      {
        id: 'tiktok',
        name: 'TikTok',
        url: 'https://tiktok.com',
        ios: 'id835599320',
        android: 'com.zhiliaoapp.musically',
      },
    ],
  },
  {
    id: 'subscriptions',
    name: 'Subscriptions',
    description: 'Streaming and subscription services.',
    services: [
      {
        id: 'spotify',
        name: 'Spotify',
        url: 'https://spotify.com',
        ios: 'id324684580',
        android: 'com.spotify.music',
      },
      {
        id: 'netflix',
        name: 'Netflix',
        url: 'https://netflix.com',
        ios: 'id363590051',
        android: 'com.netflix.mediaclient',
      },
      {
        id: 'amazon-prime',
        name: 'Amazon Prime Video',
        url: 'https://primevideo.com',
        ios: 'id545419333',
        android: 'com.amazon.avod.thirdpartyclient',
      },
      {
        id: 'disney-plus',
        name: 'Disney+',
        url: 'https://disneyplus.com',
        ios: 'id1446075948',
        android: 'com.disney.disneyplus',
      },
      {
        id: 'youtube',
        name: 'YouTube',
        url: 'https://youtube.com',
        ios: 'id544007664',
        android: 'com.google.android.youtube',
      },
      {
        id: 'apple-music',
        name: 'Apple Music',
        url: 'https://music.apple.com',
        ios: 'id1108187390',
        android: 'com.apple.android.music',
      },
    ],
  },
]);

/**
 * Supported manual-mode import formats. Each entry maps to a generator
 * function in the import-generator script, and includes the password
 * manager's website URL and step-by-step import instructions.
 */
export const IMPORT_FORMATS = Object.freeze([
  {
    id: 'bitwarden-csv',
    label: 'Bitwarden (CSV)',
    extension: 'csv',
    websiteUrl: 'https://bitwarden.com',
    importSteps: [
      'Open the Bitwarden web vault at vault.bitwarden.com',
      'Go to Tools → Import data',
      'Select "Bitwarden (csv)" as the file format',
      'Choose the file you just downloaded',
      'Click Import data',
    ],
  },
  {
    id: 'bitwarden-json',
    label: 'Bitwarden (JSON)',
    extension: 'json',
    websiteUrl: 'https://bitwarden.com',
    importSteps: [
      'Open the Bitwarden web vault at vault.bitwarden.com',
      'Go to Tools → Import data',
      'Select "Bitwarden (json)" as the file format',
      'Choose the file you just downloaded',
      'Click Import data',
    ],
  },
  {
    id: '1password-csv',
    label: '1Password (CSV)',
    extension: 'csv',
    websiteUrl: 'https://1password.com',
    importSteps: [
      'Open 1Password in your browser at start.1password.com',
      'Click your account name → Import',
      'Select "Other" as the category',
      'Choose the CSV file you just downloaded',
      'Click Import',
    ],
  },
  {
    id: 'protonpass-csv',
    label: 'Proton Pass (CSV)',
    extension: 'csv',
    websiteUrl: 'https://proton.me/pass',
    importSteps: [
      'Open Proton Pass in your browser at pass.proton.me',
      'Go to Settings → Import',
      'Select the CSV file you just downloaded',
      'Click Import to load your accounts',
    ],
  },
  {
    id: 'lastpass-csv',
    label: 'LastPass (CSV)',
    extension: 'csv',
    websiteUrl: 'https://lastpass.com',
    importSteps: [
      'Open LastPass in your browser at lastpass.com',
      'Go to Account Options → Advanced → Import',
      'Select "LastPass" as the source',
      'Choose the CSV file you just downloaded',
      'Click Import to load your accounts',
    ],
  },
]);
