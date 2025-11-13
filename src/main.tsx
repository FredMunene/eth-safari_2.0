import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PrivyProvider, type PrivyClientConfig } from '@privy-io/react-auth';
import './index.css';
import App from './App.tsx';

const privyAppId = import.meta.env.VITE_PRIVY_APP_ID;

if (!privyAppId) {
  throw new Error('Missing VITE_PRIVY_APP_ID environment variable for Privy');
}

const privyConfig: PrivyClientConfig = {
  appearance: {
    theme: 'light',
    accentColor: '#0f766e',
    logo: 'https://ethsafari.xyz/apple-touch-icon.png',
  },
  loginMethods: ['wallet', 'email', 'sms', 'google'],
  embeddedWallets: {
    createOnLogin: 'users-without-wallets',
  },
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrivyProvider appId={privyAppId} config={privyConfig}>
      <App />
    </PrivyProvider>
  </StrictMode>
);
