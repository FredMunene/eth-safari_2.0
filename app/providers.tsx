'use client';

import { PropsWithChildren } from 'react';
import { PrivyProvider, type PrivyClientConfig } from '@privy-io/react-auth';

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

if (!privyAppId) {
  throw new Error('Missing NEXT_PUBLIC_PRIVY_APP_ID environment variable for Privy');
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

export function Providers({ children }: PropsWithChildren) {
  return (
    <PrivyProvider appId={privyAppId} config={privyConfig}>
      {children}
    </PrivyProvider>
  );
}
