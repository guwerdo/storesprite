import React from 'react';
import { useAuth, SignIn } from '@clerk/clerk-react';
import type { IAuthGuardProps } from '../types/Auth.interface.js';

/**
 * Guards the app behind a Clerk sign-in.
 *
 * Backend user provisioning happens server-side: the Clerk auth hook
 * (`/api/client` scope) JIT-creates the user on any authenticated request, so
 * the client no longer needs a /client/me warm-up round-trip before rendering.
 */
export default function AuthGuard({ children }: IAuthGuardProps): React.JSX.Element {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4rem' }}>Loading auth...</div>;
  }

  if (!isSignedIn) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4rem' }}>
        <SignIn />
      </div>
    );
  }

  return <>{children}</>;
}
