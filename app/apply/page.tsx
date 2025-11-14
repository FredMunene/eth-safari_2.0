'use client';

import AuthGate from '@/components/AuthGate';
import OnboardingPortal from '@/components/OnboardingPortal';

export default function ApplyPage() {
  return (
    <div className="min-h-screen bg-sand-50 py-10 px-4">
      <AuthGate
        badgeText="ETH Safari Participant Portal"
        title="Sign in to manage your submission"
        subtitle="Connect with Privy to link your wallet or email before filling out the travel form."
        buttonLabel="Sign in with Privy"
        helperText="Need an invite token? Reach out to the ETH Safari ops desk."
      >
        <OnboardingPortal />
      </AuthGate>
    </div>
  );
}
