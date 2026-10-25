import { SocialLogin } from '@capgo/capacitor-social-login';

// Client OAuth "Web application" (audience du idToken vérifié par Supabase)
const GOOGLE_WEB_CLIENT_ID = '545174199519-ld327isies201hffeb16ae03hidn0fre.apps.googleusercontent.com';

let initialized = false;

// Connexion Google native (Credential Manager) : renvoie l'idToken pour supabase.auth.signInWithIdToken
export async function getNativeGoogleIdToken(): Promise<string | null> {
  if (!initialized) {
    await SocialLogin.initialize({
      google: { webClientId: GOOGLE_WEB_CLIENT_ID, mode: 'online' },
    });
    initialized = true;
  }

  const res = await SocialLogin.login({
    provider: 'google',
    options: { scopes: ['email', 'profile'] },
  });

  const result = res.result as { idToken?: string | null };
  return result?.idToken ?? null;
}
