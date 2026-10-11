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
      serverClientId: '1049457866930.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
