import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lamgiakhang.sochitieu',
  appName: 'Sổ Chi Tiêu',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    // You can configure Capacitor plugins here if needed
  }
};

export default config;
