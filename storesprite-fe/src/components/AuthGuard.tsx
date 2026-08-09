import React, { useEffect, useState } from 'react';
import { useAuth, SignIn } from '@clerk/clerk-react';
import { useInjection } from '../di/ContainerProvider.js';
import { TYPES } from '../di/types.js';
import type { IHttpClient } from '../types/HttpClient.interface.js';
import type { IAuthGuardProps } from '../types/Auth.interface.js';

export default function AuthGuard({ children }: IAuthGuardProps): React.JSX.Element {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [isProvisioned, setIsProvisioned] = useState<boolean>(false);
  const httpClient = useInjection<IHttpClient>(TYPES.IHttpClient);

  useEffect(() => {
    let isMounted = true;

    const initializeSession = async (): Promise<void> => {
      if (!isSignedIn) {
        setIsProvisioned(false);
        return;
      }

      try {
        const token = await getToken();
        // Call /client/me using the injected httpClient with Clerk Bearer token
        await httpClient.get('/client/me', {
          Authorization: `Bearer ${token ?? ''}`,
        });
      } catch (err: unknown) {
        console.error('Failed to initialize session with backend:', err);
      } finally {
        if (isMounted) {
          setIsProvisioned(true);
        }
      }
    };

    if (isLoaded && isSignedIn) {
      void initializeSession();
    } else if (isLoaded && !isSignedIn) {
      setIsProvisioned(false);
    }

    return () => {
      isMounted = false;
    };
  }, [isLoaded, isSignedIn, getToken, httpClient]);

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

  if (!isProvisioned) {
    return <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4rem' }}>Initializing session...</div>;
  }

  return <>{children}</>;
}
