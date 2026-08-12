/**
 * Sediba Aesthetic & Wellness Clinic — mobile design tokens.
 * Synced from the sibling web artifact (artifacts/sediba-clinic/src/index.css).
 */

const colors = {
  light: {
    // Legacy aliases
    text: '#1A1A1A',
    tint: '#C4A882',

    // Core surfaces
    background: '#FFFFFF',
    foreground: '#1A1A1A',

    // Cards / elevated surfaces
    card: '#FFFFFF',
    cardForeground: '#1A1A1A',

    // Primary action — warm tan (#C4A882)
    primary: '#C4A882',
    primaryForeground: '#FFFFFF',

    // Secondary — dark grey (#3C3C3C)
    secondary: '#3C3C3C',
    secondaryForeground: '#FFFFFF',

    // Muted — light grey (#D4D4D4)
    muted: '#D4D4D4',
    mutedForeground: '#9B9B9B',

    // Accent — warm grey (#9B9B9B)
    accent: '#9B9B9B',
    accentForeground: '#FFFFFF',

    // Destructive
    destructive: '#E53E3E',
    destructiveForeground: '#FFFFFF',

    // Borders and inputs
    border: '#D4D4D4',
    input: '#D4D4D4',
  },

  dark: {
    text: '#FFFFFF',
    tint: '#C4A882',

    background: '#1A1A1A',
    foreground: '#FFFFFF',

    card: '#242424',
    cardForeground: '#FFFFFF',

    primary: '#C4A882',
    primaryForeground: '#1A1A1A',

    secondary: '#3C3C3C',
    secondaryForeground: '#FFFFFF',

    muted: '#3C3C3C',
    mutedForeground: '#9B9B9B',

    accent: '#3C3C3C',
    accentForeground: '#FFFFFF',

    destructive: '#E53E3E',
    destructiveForeground: '#FFFFFF',

    border: '#3C3C3C',
    input: '#3C3C3C',
  },

  // Sharp edges matching the web app's --radius: 0rem
  radius: 0,
};

export default colors;
