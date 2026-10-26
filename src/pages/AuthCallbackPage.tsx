import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { toTurkishError } from "../lib/errorMessages";

const AuthCallbackPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // 🔹 Récupérer les paramètres de l'URL (peuvent être perdus après OAuth sur mobile)
        const urlRole = searchParams.get("role");
        const urlFlowToken = searchParams.get("flow_token");

        // 💾 Récupérer depuis localStorage si params URL vides (backup mobile)
        const pendingRole = localStorage.getItem('pending_auth_role');
        const pendingFlowToken = localStorage.getItem('pending_flow_token');

        // Utiliser les valeurs URL en priorité, sinon localStorage
        const effectiveRole = urlRole || pendingRole;
        const flowToken = urlFlowToken || pendingFlowToken;

        // 🧹 Nettoyer le localStorage après lecture
        localStorage.removeItem('pending_auth_role');
        localStorage.removeItem('pending_flow_token');

        // 🔐 Vérifier si les tokens OAuth sont dans le hash (deep link mobile)
        // Le hash peut venir de window.location.hash OU de location.state (navigation depuis DeepLinkHandler)
        const stateHash = (location.state as { oauthHash?: string } | null)?.oauthHash;
        const hash = stateHash || window.location.hash;

        if (hash && hash.includes('access_token')) {
          // Extraire les tokens du hash
          const hashParams = new URLSearchParams(hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          if (accessToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });

            if (sessionError) {
              console.error("🔐 Erreur setSession:", sessionError.message);
              setError(toTurkishError(sessionError, "Oturum başlatılamadı. Lütfen tekrar giriş yapın."));
              setLoading(false);
              return;
            }

            // Nettoyer le hash de l'URL pour éviter les problèmes
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        }

        // 🔹 Attendre session valide
        let session = null;
        for (let i = 0; i < 10; i++) {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            session = data.session;
            break;
          }
          await new Promise((r) => setTimeout(r, 500));
        }

        if (!session) {
          setError("Oturum alınamadı. Lütfen tekrar giriş yapın.");
          setLoading(false);
          return;
        }

        const user = session.user;

        // 1️⃣ Déterminer le rôle RÉEL (priorité: flow_states > URL/localStorage > défaut)
        let actualRole = effectiveRole || "client";

        if (flowToken) {
          // 🔹 Récupérer le rôle depuis flow_states (source fiable!)
          const { data: flowData, error: flowFetchError } = await supabase
            .from("flow_states")
            .select("desired_role")
            .eq("token", flowToken)
            .single();

          if (flowFetchError) {
            console.warn("⚠️ Erreur récupération flow_state:", flowFetchError.message);
          } else if (flowData?.desired_role) {
            actualRole = flowData.desired_role;
          }

          // 🔹 Marquer le flow_state comme utilisé
          await supabase
            .from("flow_states")
            .update({ auth_user_id: user.id, used: true })
            .eq("token", flowToken);
        }

        // 2️⃣ Création du profil uniquement s'il n'existe pas.
        // Un profil existant garde TOUJOURS son rôle (un marchand qui utilise
        // le bouton Google client reste marchand, et inversement).
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("role, first_name, last_name")
          .eq("auth_id", user.id)
          .maybeSingle();

        let finalRole: string = actualRole;
        let firstName: string | null = null;
        let lastName: string | null = null;

        if (existingProfile) {
          firstName = existingProfile.first_name;
          lastName = existingProfile.last_name;
          if (existingProfile.role) {
            finalRole = existingProfile.role;
          } else {
            // Profil créé sans rôle (ex. par ensure_profile_exists) → on le complète
            const { error: updateError } = await supabase
              .from("profiles")
              .update({ role: actualRole })
              .eq("auth_id", user.id)
              .is("role", null);
            if (updateError) {
              console.warn("Profil: rôle non enregistré:", updateError.message);
            }
          }
        } else {
          const { error: insertError } = await supabase
            .from("profiles")
            .insert({
              auth_id: user.id,
              email: user.email,
              role: actualRole,
            });

          if (insertError) {
            console.warn("Profil non créé:", insertError.message);
          }
        }

        // 3️⃣ Redirection selon le rôle réel ET la complétude du profil
        setIsRedirecting(true);
        if (finalRole === "merchant") {
          navigate("/merchant/dashboard", { replace: true });
        } else if (!firstName || !lastName) {
          // Profil client incomplet → la page d'auth affichera le formulaire de profil
          navigate("/customer/auth", { replace: true });
        } else {
          navigate("/offers", { replace: true });
        }
      } catch (err) {
        console.error("OAuth callback error:", err);
        setError(toTurkishError(err, "Giriş tamamlanamadı. Lütfen tekrar deneyin."));
      } finally {
        setLoading(false);
      }
    };

    handleOAuthCallback();
  }, [navigate, searchParams, location.state]);

  if (loading || isRedirecting) {
    return (
      <div className="min-h-screen bg-kk-paper flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-kk-mint border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">
            {isRedirecting ? "Yönlendiriliyor..." : "Giriş tamamlanıyor..."}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-kk-paper flex items-center justify-center px-4">
        <div className="kk-card p-8 max-w-md w-full">
          <div className="text-center">
            <div className="w-16 h-16 bg-kk-coral rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-kk-night text-2xl font-bold">✕</span>
            </div>
            <h2 className="text-2xl font-display font-extrabold tracking-tight text-kk-night mb-2">Giriş hatası</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => navigate("/")}
              className="w-full kk-btn-primary py-3"
            >
              Ana Sayfaya Dön
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default AuthCallbackPage;