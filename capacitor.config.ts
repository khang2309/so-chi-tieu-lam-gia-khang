import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lamgiakhang.sochitieu',
  appName: 'Sổ Chi Tiêu',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      clientId: '1049457866930-8p1gu1bmhm5f8q6fs4k14s1meb2h5l6f.apps.googleusercontent.com',
      serverClientId: '1049457866930-8p1gu1bmhm5f8q6fs4k14s1meb2h5l6f.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
