import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kapkurtar.app',
  appName: 'KapKurtar',
  webDir: 'dist',
  android: {
    overScrollMode: 'never'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      launchAutoHide: true,
    },
    StatusBar: {
      overlaysWebView: true,
      backgroundColor: '#0D0E12',
      style: 'DARK'
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    SocialLogin: {
      providers: {
        google: true,
        facebook: false,
        apple: false,
        twitter: false
      }
    }
  }
};

export default config;
