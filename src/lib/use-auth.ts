import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook: useAuth
 * 
 * Manages Google OAuth authentication state for public forms.
 * Reads from sessionStorage (set by /auth/callback) and Supabase session.
 * 
 * Returns: { email, name, verified, user, isLoading, error, signOut }
 */

export type AuthSession = {
  email: string;
  name: string;
  verified: boolean;
  userId: string;
  provider: 'google';
  timestamp: number;
};

export type UseAuthReturn = {
  session: AuthSession | null;
  isLoading: boolean;
  error: Error | null;
  signOut: () => Promise<void>;
};

export function useAuth(): UseAuthReturn {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    initializeAuth();
  }, []);

  async function initializeAuth() {
    try {
      setIsLoading(true);

      // First, check sessionStorage for auth state (set by callback route)
      const storedAuth = sessionStorage.getItem('ith_forms_auth');
      if (storedAuth) {
        try {
          const authState = JSON.parse(storedAuth) as AuthSession;
          console.log('[useAuth] Found stored auth session:', {
            email: authState.email,
            verified: authState.verified,
          });
          setSession(authState);
          setIsLoading(false);
          return;
        } catch (e) {
          console.warn('[useAuth] Stored auth session corrupted:', e);
          sessionStorage.removeItem('ith_forms_auth');
        }
      }

      // Fall back to Supabase session (in case page reloaded)
      const { data, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (data?.session?.user?.email) {
        const user = data.session.user;
        const authState: AuthSession = {
          email: user.email || '',
          name: user.user_metadata?.full_name || user.user_metadata?.name || 'User',
          verified: true,
          userId: user.id,
          provider: 'google',
          timestamp: Date.now(),
        };
        sessionStorage.setItem('ith_forms_auth', JSON.stringify(authState));
        console.log('[useAuth] Found Supabase session:', {
          email: authState.email,
          verified: authState.verified,
        });
        setSession(authState);
      } else {
        console.log('[useAuth] No active auth session');
        setSession(null);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[useAuth] Initialization error:', error);
      setError(error);
    } finally {
      setIsLoading(false);
    }
  }

  async function signOut() {
    try {
      console.log('[useAuth] Signing out...');
      // Clear Supabase session
      await supabase.auth.signOut();
      // Clear sessionStorage
      sessionStorage.removeItem('ith_forms_auth');
      setSession(null);
      console.log('[useAuth] Sign out complete');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[useAuth] Sign out error:', error);
      setError(error);
    }
  }

  return {
    session,
    isLoading,
    error,
    signOut,
  };
}

/**
 * Hook: useAuthSubmissionStatus
 * 
 * Fetches submission status for current user's email on a form.
 * Returns: { submission_count, limit, can_submit, message, isLoading }
 */

export type SubmissionStatus = {
  email: string;
  submission_count: number;
  limit: number | null;
  can_submit: boolean;
  message: string;
};

export type UseAuthSubmissionStatusReturn = {
  status: SubmissionStatus | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

export function useAuthSubmissionStatus(
  formId: string | undefined,
  email: string | undefined
): UseAuthSubmissionStatusReturn {
  const [status, setStatus] = useState<SubmissionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(!formId || !email);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!formId || !email) {
      setStatus(null);
      setIsLoading(false);
      return;
    }

    fetchSubmissionStatus();
  }, [formId, email]);

  async function fetchSubmissionStatus() {
    if (!formId || !email) return;

    try {
      setIsLoading(true);
      console.log('[useAuthSubmissionStatus] Fetching status for:', {
        formId,
        email,
      });

      const { data, error: rpcError } = await supabase.rpc(
        'get_submission_count_for_email',
        {
          p_form_id: formId,
          p_email: email,
        }
      );

      if (rpcError) {
        throw new Error(rpcError.message || 'Failed to fetch submission status');
      }

      const statusData = data as SubmissionStatus;
      console.log('[useAuthSubmissionStatus] Status:', statusData);
      setStatus(statusData);
      setError(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[useAuthSubmissionStatus] Error:', error);
      setError(error);
      setStatus(null);
    } finally {
      setIsLoading(false);
    }
  }

  return {
    status,
    isLoading,
    error,
    refetch: fetchSubmissionStatus,
  };
}
