import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, ActionPerformed } from '@capacitor/push-notifications';
import { supabase } from '../lib/supabaseClient';

/**
 * Service de gestion des Push Notifications
 * - Demande la permission
 * - Récupère et enregistre le token FCM
 * - Gère les notifications reçues
 */

// Variable pour éviter les initialisations multiples
let isInitialized = false;

/**
 * Récupère le profile_id de l'utilisateur connecté
 */
async function getProfileId(authId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_id', authId)
      .single();

    if (error) {
      console.error('❌ Erreur récupération profile_id:', error.message);
      return null;
    }

    return data?.id || null;
  } catch (error) {
    console.error('❌ Exception récupération profile_id:', error);
    return null;
  }
}

/**
 * Attend que la session Supabase soit prête (avec retry)
 * @param maxAttempts Nombre maximum de tentatives
 * @param delayMs Délai entre chaque tentative en ms
 * @returns La session si trouvée, null sinon
 */
async function waitForSession(maxAttempts = 3, delayMs = 1000): Promise<{
  session: { access_token: string; user: { id: string } } | null;
  attempt: number;
}> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.warn('⚠️ Erreur getSession:', error.message);
    }

    // Vérifier que la session ET l'access_token existent
    if (session?.access_token && session?.user?.id) {
      return { session, attempt };
    }

    // Attendre avant la prochaine tentative (sauf si dernière)
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      // Augmenter le délai progressivement (backoff)
      delayMs = Math.min(delayMs * 1.5, 3000);
    }
  }

  return { session: null, attempt: maxAttempts };
}

/**
 * Enregistre ou met à jour le token FCM dans Supabase
 * Utilise getSession() pour garantir une session authentifiée
 */
async function saveTokenToSupabase(token: string): Promise<boolean> {
  try {
    // IMPORTANT: Utiliser getSession() au lieu de getUser()
    // getUser() peut réussir même si le client n'a pas de session active
    // getSession() garantit qu'on a un access_token pour authentifier les requêtes
    const { session } = await waitForSession(3, 1000);

    if (!session) {
      console.error('❌ Pas de session active après 3 tentatives');
      return false;
    }

    const authId = session.user.id;
    const profileId = await getProfileId(authId);

    if (!profileId) {
      console.error('❌ Profile_id non trouvé pour auth_id');
      return false;
    }

    // Déterminer la plateforme
    const platform = Capacitor.getPlatform() as 'android' | 'ios';

    // Double vérification: s'assurer que la session est toujours active
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession?.access_token) {
      console.error('❌ Session perdue avant upsert');
      return false;
    }

    // Upsert le token (insert ou update si déjà existant)
    const { error } = await supabase
      .from('device_push_tokens')
      .upsert(
        {
          profile_id: profileId,
          auth_id: authId,
          token: token,
          platform: platform,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'token', // Évite les doublons
        }
      );

    if (error) {
      console.error('❌ Erreur sauvegarde token:', error.message, error.code);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Exception sauvegarde token:', error);
    return false;
  }
}

/**
 * Désactive le token push pour l'utilisateur (à appeler lors de la déconnexion)
 */
export async function deactivatePushToken(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    await supabase
      .from('device_push_tokens')
      .update({ is_active: false })
      .eq('auth_id', user.id);

  } catch (error) {
    console.error('❌ Erreur désactivation token:', error);
  }
}

/**
 * Gère le tap sur une notification
 */
function handleNotificationAction(action: ActionPerformed): void {
  const data = action.notification.data;
  const offerUrl = data?.offer_id
    ? `/offers?offer_id=${encodeURIComponent(data.offer_id)}`
    : '/offers';

  // Navigation basée sur le type de notification
  if (data?.type === 'offer' || data?.type === 'offer_nearby') {
    window.location.href = offerUrl;
  } else if (data?.type === 'reservation') {
    window.location.href = '/merchant/dashboard';
  } else if (data?.offer_id) {
    window.location.href = offerUrl;
  }
}

/**
 * Initialise les push notifications
 * Doit être appelé après la connexion de l'utilisateur
 */
export async function initPushNotifications(): Promise<boolean> {
  // Ne pas initialiser sur web
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  // Éviter les initialisations multiples
  if (isInitialized) {
    return true;
  }

  try {
    // Vérifier si l'utilisateur est connecté
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return false;
    }

    // Vérifier la permission actuelle
    let permStatus = await PushNotifications.checkPermissions();

    // Demander la permission si nécessaire
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn('⚠️ Permission push notifications refusée');
      return false;
    }

    // Configurer les listeners AVANT de s'enregistrer

    // Quand on reçoit le token
    await PushNotifications.addListener('registration', async (token: Token) => {
      await saveTokenToSupabase(token.value);
    });

    // En cas d'erreur d'enregistrement
    await PushNotifications.addListener('registrationError', (error) => {
      console.error('❌ Erreur registration push:', error);
    });

    // Notification reçue (app au premier plan)
    await PushNotifications.addListener('pushNotificationReceived', () => {
      // Rien à faire ici : les notifications in-app arrivent via le realtime Supabase
    });

    // Tap sur notification (app en arrière-plan ou fermée)
    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      handleNotificationAction(action);
    });

    // S'enregistrer pour recevoir les notifications
    await PushNotifications.register();

    isInitialized = true;
    return true;
  } catch (error) {
    console.error('❌ Exception init push:', error);
    return false;
  }
}

/**
 * Nettoie les listeners (à appeler lors de la déconnexion si nécessaire)
 */
export async function cleanupPushNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await PushNotifications.removeAllListeners();
    isInitialized = false;
  } catch (error) {
    console.error('❌ Erreur nettoyage listeners:', error);
  }
}
