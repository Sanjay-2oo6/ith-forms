import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';

/**
 * Google OAuth Callback Handler
 * 
 * After user approves Google consent, they're redirected here with
 * an authorization code in the URL fragment. This route:
 * 1. Exchanges the code for a session via Supabase
 * 2. Extracts email + name from user metadata
 * 3. Stores auth state in sessionStorage
 * 4. Redirects back to the form (preserving slug)
 * 
 * Must be client-only (ssr: false) because it uses browser APIs (sessionStorage)
 * and client-side routing (useNavigate).
 */

export const Route = createFileRoute('/auth/callback')({
  ssr: false,
  component: AuthCallback,
});

type SearchParams = {
  slug?: string;
  redirectTo?: string;
};

function AuthCallback() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as SearchParams;
  const [slug, setSlug] = useState<string>("");

  useEffect(() => {
    // On mount, extract slug from sessionStorage
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem('oauth_form_slug');
      if (stored) {
        console.log('[auth/callback] Retrieved slug from sessionStorage:', stored);
        setSlug(stored);
      } else {
        console.log('[auth/callback] No slug in sessionStorage, slug is empty');
        setSlug("");
      }
    }
  }, []);

  useEffect(() => {
    if (slug !== undefined) {
      handleCallback();
    }
  }, [slug]);

  async function handleCallback() {
    try {
      console.log('[auth/callback] Starting OAuth callback handler');
      console.log('[auth/callback] URL:', typeof window !== "undefined" ? window.location.href : "N/A");
      console.log('[auth/callback] Search params:', search);
      console.log('[auth/callback] Extracted slug:', slug);

      // Get the current session (Supabase automatically exchanges the code)
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error('[auth/callback] Session error:', error);
        redirectToForm();
        return;
      }

      if (!data?.session?.user) {
        console.warn('[auth/callback] No user session found after callback');
        redirectToForm();
        return;
      }

      const user = data.session.user;
      const email = user.email;
      const name = user.user_metadata?.full_name || user.user_metadata?.name || 'User';

      if (!email) {
        console.error('[auth/callback] No email in user metadata');
        redirectToForm();
        return;
      }

      console.log('[auth/callback] User authenticated:', {
        email,
        name,
        userId: user.id,
      });

      // Store auth state in sessionStorage for the form to access
      const authState = {
        email,
        name,
        verified: true,
        userId: user.id,
        provider: 'google',
        timestamp: Date.now(),
      };

      sessionStorage.setItem('ith_forms_auth', JSON.stringify(authState));
      console.log('[auth/callback] Auth state stored in sessionStorage');

      // Redirect back to form
      redirectToForm();
    } catch (error) {
      console.error('[auth/callback] Unexpected error:', error);
      redirectToForm();
    }
  }

  function redirectToForm() {
    // Redirect to form if slug is available, otherwise to home
    if (slug && slug.trim()) {
      console.log('[auth/callback] Redirecting to form:', slug);
      navigate({ to: `/forms/${slug}` });
    } else {
      console.log('[auth/callback] No slug found, redirecting to home');
      navigate({ to: '/' });
    }
  }

  // Show loading spinner while processing
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-border border-t-primary" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-2">Signing you in...</h2>
        <p className="text-sm text-muted-foreground">
          Please wait while we process your authentication.
        </p>
      </div>
    </div>
  );
}
