/**
 * Editable copy for the intro pages. Kept separate from components so
 * wording can be reviewed without touching layout code.
 *
 * Each entry renders as its own page with a Next button (bottom-right).
 * The final entry's `kind: 'strength-checker'` renders the interactive
 * strength checker instead of static copy.
 *
 * Pages with `paragraphs` render each entry as a separate paragraph with
 * vertical spacing between them, breaking up walls of text.
 *
 * Pages with `sections` render grouped content with sub-headings and
 * bullet lists.
 */

export const INTRO_PAGES = Object.freeze([
  {
    id: 'welcome',
    kind: 'welcome',
  },
  {
    id: 'what-is-pm',
    kind: 'content',
    heading: 'What is a password manager?',
    paragraphs: [
      'A password manager is a single secure app that stores all your passwords for you, so you only need to remember one strong master password.',
    ],
  },
  {
    id: 'why-it-matters',
    kind: 'content',
    heading: 'Why does it matter?',
    paragraphs: [
      'Reusing passwords means that one cyber attack can be used to compromise multiple online accounts.',
      'A password manager gives every account a unique, strong password without you having to remember any of them.',
    ],
  },
  {
    id: 'benefits',
    kind: 'content',
    heading: 'What are the benefits?',
    paragraphs: [
      'Password managers make things harder for attackers but easier for you!',
    ],
    sections: [
      {
        subHeading: 'Install it on:',
        bullets: [
          'your phone',
          'personal computer, and',
          'as a web browser extension.',
        ],
      },
      {
        subHeading: 'and you will:',
        bullets: [
          'Log in faster with autofill, face-ID or fingerprint',
          'Get warned about leaked passwords, and',
          'Auto-create new passwords with one click.',
        ],
      },
    ],
  },
  {
    id: 'strength-checker',
    kind: 'strength-checker',
    heading: 'Is your password any good?',
    bodyBefore: 'Type in any password, passphrase or PIN below to see how strong it',
    bodyBold: 'really',
    bodyAfter: 'is.',
    cardParagraphs: [
      'Passphrases like',
      'are considered stronger than something like',
    ],
    passphraseGood: 'longing-rusted-seventeen-daybreak',
    passphraseBad: 'Aw3someSauce42#!',
    cardParagraphs2: [
      'Hackers can write code to easily guess the types of passwords humans come up with themselves',
    ],
    cardItalicLine: 'e.g. a capitalised word with some numbers and then a symbol',
  },
]);
