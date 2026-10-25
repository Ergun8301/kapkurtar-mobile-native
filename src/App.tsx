import { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { HelmetProvider } from 'react-helmet-async';
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import Header from "./components/Header";
import Footer from "./components/Footer";
import ScrollToTop from "./components/ScrollToTop";
import BottomNav from "./components/navigation/BottomNav";
import { AddProductProvider } from "./contexts/AddProductContext";
import { supabase } from "./lib/supabaseClient";

// ✅ Pages principales
import HomePage from "./pages/HomePage";
import OffersPage from "./pages/OffersPage";
import CustomerAuthPage from "./pages/CustomerAuthPage";
import MerchantAuthPage from "./pages/MerchantAuthPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import MerchantForgotPasswordPage from "./pages/MerchantForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import MerchantDashboardPage from "./pages/MerchantDashboardPage";
import ClientProfilePage from "./pages/ClientProfilePage";
import ClientDashboardPage from "./pages/ClientDashboardPage";
import UserTypeSelectionPage from "./pages/UserTypeSelectionPage";

// ✅ Pages utilisateurs
import DownloadPage from "./pages/DownloadPage";
import NotFoundPage from "./pages/NotFoundPage";

// ✅ Pages marketing
import FAQPage from "./pages/FAQPage";
import BlogPage from "./pages/BlogPage";
import ContactPage from "./pages/ContactPage";
import AboutPage from "./pages/AboutPage";
import ForMerchantsPage from "./pages/ForMerchantsPage";
import LegalPage from "./pages/LegalPage";
import CityPage from "./pages/CityPage";

// ✅ Articles blog
import BlogArticle4 from "./pages/BlogArticle4";
import BlogArticle5 from "./pages/BlogArticle5";
import BlogArticle6 from "./pages/BlogArticle6";
import BlogArticle7 from "./pages/BlogArticle7";
import BlogArticle8 from "./pages/BlogArticle8";
import BlogArticle9 from "./pages/BlogArticle9";
import BlogArticle10 from "./pages/BlogArticle10";

/* 🔗 Gère les deep links sur mobile natif */
// L'URL de lancement (cold start) ne doit être traitée qu'une seule fois
let launchUrlHandled = false;

function DeepLinkHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    // Toujours configurer les listeners (même si on ne sait pas encore si c'est natif)
    // Le check se fait côté natif, pas besoin de vérifier isNativePlatform() ici

    let isHandlingDeepLink = false;

    const handleDeepLink = async (url: string) => {
      // Éviter les doubles traitements
      if (isHandlingDeepLink) {
        return;
      }
      isHandlingDeepLink = true;

      try {
        let path = '';
        let search = '';
        let hash = '';

        // Parser l'URL selon son format
        if (url.startsWith('com.kapkurtar.app:')) {
          // Custom scheme
          const withoutScheme = url.replace('com.kapkurtar.app:', '');
          const cleanPath = withoutScheme.replace(/^\/+/, '/');
          const hashIndex = cleanPath.indexOf('#');
          const searchIndex = cleanPath.indexOf('?');

          if (hashIndex !== -1) {
            hash = cleanPath.substring(hashIndex);
            path = searchIndex !== -1 ? cleanPath.substring(0, searchIndex) : cleanPath.substring(0, hashIndex);
            search = searchIndex !== -1 && searchIndex < hashIndex ? cleanPath.substring(searchIndex, hashIndex) : '';
          } else if (searchIndex !== -1) {
            path = cleanPath.substring(0, searchIndex);
            search = cleanPath.substring(searchIndex);
          } else {
            path = cleanPath;
          }
        } else {
          // URL standard (https://kapkurtar.com/...)
          try {
            const urlObj = new URL(url);
            path = urlObj.pathname;
            search = urlObj.search;
            hash = urlObj.hash;
          } catch {
            console.error('🔗 [DeepLink] URL invalide:', url);
            isHandlingDeepLink = false;
            return;
          }
        }

        // Fermer le browser in-app d'abord
        try {
          await Browser.close();
        } catch {
          // Ignorer - le browser n'était peut-être pas ouvert
        }

        // 🔑 Lien de réinitialisation du mot de passe : ouvrir la session de récupération
        // puis afficher /reset-password (et non /auth/callback)
        if (hash && hash.includes('access_token') && (path === '/reset-password' || hash.includes('type=recovery'))) {
          const hashParams = new URLSearchParams(hash.substring(1));
          const accessToken = hashParams.get('access_token');
          if (accessToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: hashParams.get('refresh_token') || '',
            });
            if (error) {
              console.error('[DeepLink] setSession (recovery) error:', error.message);
            }
          }
          navigate('/reset-password', { replace: true });
          return;
        }

        // 🔐 Si le hash contient des tokens OAuth, naviguer vers /auth/callback avec les tokens
        if (hash && hash.includes('access_token')) {
          // Utiliser navigate() au lieu de window.location.href pour éviter le rechargement
          const callbackPath = '/auth/callback' + search;

          // Passer le hash via state car navigate() ne supporte pas les hash fragments
          navigate(callbackPath, {
            state: { oauthHash: hash },
            replace: true
          });
          return;
        }

        // Navigation standard pour les autres deep links
        const fullPath = path + search + hash;
        navigate(fullPath, { replace: true });
      } catch (error) {
        console.error('❌ [DeepLink] Erreur parsing:', error);
      } finally {
        // Reset après un court délai pour permettre les nouveaux deep links
        setTimeout(() => {
          isHandlingDeepLink = false;
        }, 1000);
      }
    };

    // Écouter les deep links entrants
    const setupDeepLinks = async () => {
      // Vérifier si l'app a été lancée via deep link (cold start)
      try {
        const appUrlOpen = await CapacitorApp.getLaunchUrl();
        if (appUrlOpen?.url && !launchUrlHandled) {
          launchUrlHandled = true;
          // Petit délai pour s'assurer que React Router est prêt
          setTimeout(() => handleDeepLink(appUrlOpen.url), 100);
        }
      } catch {
        // getLaunchUrl non disponible (web)
      }

      // Écouter les deep links pendant que l'app est ouverte (warm start)
      try {
        CapacitorApp.addListener('appUrlOpen', (event) => {
          handleDeepLink(event.url);
        });
      } catch {
        // addListener non disponible (web)
      }
    };

    setupDeepLinks();

    // Cleanup listener
    return () => {
      try {
        CapacitorApp.removeAllListeners();
      } catch {
        // Ignorer sur web
      }
    };
  }, [navigate]);

  return null;
}

/* 🔁 CONFIGURATION DES ROUTES PAR TYPE (même logique que le web) */

// Routes publiques : accessibles par TOUS (connectés ou non)
const publicRoutes = [
  '/legal',
  '/blog',
  '/contact',
  '/about',
  '/faq',
  '/for-merchants',
  '/download',
  '/istanbul',
  '/ankara',
  '/izmir',
  '/antalya',
  '/bursa',
];

// Routes d'authentification : accessibles par tous
const authRoutes = [
  '/customer/auth',
  '/merchant/auth',
  '/forgot-password',
  '/merchant/forgot-password',
  '/reset-password',
  '/auth/callback',
];

// Routes client uniquement
const clientOnlyRoutes = [
  '/customer/dashboard',
  '/client/profile',
];

// Routes marchand uniquement
const merchantOnlyRoutes = [
  '/merchant/dashboard',
];

/* 🔁 Vérifie la session et redirige selon le rôle */
function SessionRedirect() {
  const nav = useNavigate();
  const location = useLocation();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    (async () => {
      const currentPath = location.pathname;

      // 1. Pages publiques et pages auth : toujours accessibles
      if (
        publicRoutes.includes(currentPath) ||
        currentPath.startsWith('/blog/') ||
        authRoutes.includes(currentPath)
      ) {
        setChecked(true);
        return;
      }

      // 2. Utilisateur non connecté : aucune redirection
      // (sur natif, "/" affiche UserTypeSelectionPage)
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setChecked(true);
        return;
      }

      // 3. Récupérer le rôle
      const { data, error } = await supabase
        .from("profiles")
        .select("role, first_name, last_name")
        .eq("auth_id", user.id)
        .single();

      if (error || !data) {
        setChecked(true);
        return;
      }

      const { role, first_name, last_name } = data;

      // 4. Marchands : bloquer les pages client, rediriger depuis "/"
      if (role === "merchant") {
        if (clientOnlyRoutes.includes(currentPath) || currentPath === "/") {
          nav("/merchant/dashboard", { replace: true });
          return;
        }
        setChecked(true);
        return;
      }

      // 5. Clients
      if (role === "client") {
        // Profil incomplet : laisser passer (pour compléter le profil)
        if (!first_name || !last_name) {
          setChecked(true);
          return;
        }
        if (merchantOnlyRoutes.includes(currentPath) || currentPath === "/") {
          nav("/offers", { replace: true });
          return;
        }
      }

      setChecked(true);
    })();
  }, [nav, location.pathname]);

  if (!checked) return null;
  return null;
}

function App() {
  // Détecter si on est sur mobile natif (Android/iOS via Capacitor)
  const isNative = Capacitor.isNativePlatform();

  // Ajouter classe native-app sur html pour CSS global
  useEffect(() => {
    if (isNative) {
      document.documentElement.classList.add('native-app');
    }
    return () => {
      document.documentElement.classList.remove('native-app');
    };
  }, [isNative]);

  return (
    <HelmetProvider>
      <AddProductProvider>
        <Router>
          <div className={`flex flex-col bg-white ${isNative ? 'h-screen' : 'min-h-screen'}`}>
            <Header />
            {/* Spacer pour compenser le header fixe (64px + 25px safe area sur natif) */}
            <div style={{ height: isNative ? '89px' : '64px' }} />
            <ScrollToTop />
            {/* 🔗 Handler pour les deep links sur mobile */}
            <DeepLinkHandler />
            {/* Main avec padding-bottom pour la BottomNav sur mobile natif */}
            <main
              className="flex-grow"
              style={{ paddingBottom: isNative ? '110px' : '0px' }}
            >
              <SessionRedirect />
              <Routes>
              {/* 🏠 Accueil - Page de sélection sur mobile natif, HomePage sur web */}
              <Route path="/" element={isNative ? <UserTypeSelectionPage /> : <HomePage />} />

              {/* 🗺️ Offres */}
              <Route path="/offers" element={<OffersPage />} />

              {/* 👤 Profils clients */}
              <Route path="/client/profile" element={<ClientProfilePage />} />
              <Route path="/customer/dashboard" element={<ClientDashboardPage />} />

              {/* 🔐 Authentification */}
              <Route path="/customer/auth" element={<CustomerAuthPage />} />
              <Route path="/merchant/auth" element={<MerchantAuthPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/merchant/forgot-password" element={<MerchantForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              {/* 🏪 Tableau de bord marchand */}
              <Route path="/merchant/dashboard" element={<MerchantDashboardPage />} />

              {/* 📱 Téléchargement */}
              <Route path="/download" element={<DownloadPage />} />

              {/* 📚 Pages marketing */}
              <Route path="/faq" element={<FAQPage />} />
              <Route path="/blog" element={<BlogPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/for-merchants" element={<ForMerchantsPage />} />
              <Route path="/legal" element={<LegalPage />} />

              {/* 🏙️ Pages villes (SEO local) */}
              <Route path="/istanbul" element={<CityPage city="istanbul" cityTurkish="İstanbul" />} />
              <Route path="/ankara" element={<CityPage city="ankara" cityTurkish="Ankara" />} />
              <Route path="/izmir" element={<CityPage city="izmir" cityTurkish="İzmir" />} />
              <Route path="/antalya" element={<CityPage city="antalya" cityTurkish="Antalya" />} />
              <Route path="/bursa" element={<CityPage city="bursa" cityTurkish="Bursa" />} />

              {/* 📰 Articles blog individuels */}
              <Route path="/blog/4" element={<BlogArticle4 />} />
              <Route path="/blog/5" element={<BlogArticle5 />} />
              <Route path="/blog/6" element={<BlogArticle6 />} />
              <Route path="/blog/7" element={<BlogArticle7 />} />
              <Route path="/blog/8" element={<BlogArticle8 />} />
              <Route path="/blog/9" element={<BlogArticle9 />} />
              <Route path="/blog/10" element={<BlogArticle10 />} />

              {/* 🚫 Redirections anciennes */}
              <Route
                path="/customer/teaser"
                element={<Navigate to="/offers" replace />}
              />
              <Route path="/favorites" element={<Navigate to="/offers" replace />} />
              <Route path="/reviews" element={<Navigate to="/offers" replace />} />
              <Route path="/profile/complete" element={<Navigate to="/offers" replace />} />

              {/* 404 */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
          {/* Footer visible uniquement sur web (pas sur mobile natif) */}
          {!isNative && <Footer />}
          {/* BottomNav visible uniquement sur mobile natif */}
          {isNative && <BottomNav />}
        </div>
      </Router>
    </AddProductProvider>
    </HelmetProvider>
  );
}

export default App;