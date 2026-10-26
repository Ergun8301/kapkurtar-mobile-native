import React from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingCart, Store } from "lucide-react";
import Logo from "../components/brand/Logo";

/**
 * Page de sélection du type d'utilisateur
 * Affichée uniquement sur mobile natif (Capacitor) comme porte d'entrée
 * Redirige vers les pages d'authentification existantes
 */
const UserTypeSelectionPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div
      className="h-screen overflow-hidden flex flex-col px-6 py-8 bg-kk-night text-white"
    >
      {/* HAUT - Logo et messages */}
      <div className="text-center pt-4 pb-6">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Logo tone="light" size={40} />
        </div>
        <h1 className="font-display font-extrabold tracking-tight text-5xl leading-[0.95] text-white mb-3">
          Hoş <span className="text-kk-lime">Geldiniz!</span>
        </h1>
        <p className="text-base text-kk-muted">
          Gıda israfını birlikte önleyelim
        </p>
        {/* Illustration food */}
        <div className="text-3xl pt-4 opacity-80">
          🍎 🍕 🥕 🥬 🍞
        </div>
      </div>

      {/* MILIEU + BAS - Boutons */}
      <div className="flex-1 flex flex-col justify-center gap-4 pb-8">
        {/* Bouton Client */}
        <button
          onClick={() => navigate("/customer/auth")}
          className="flex-1 max-h-[160px] rounded-3xl bg-white/5 border border-white/10 flex flex-col items-center justify-center transition-transform active:scale-[0.98] active:bg-white/10"
        >
          <span className="w-16 h-16 rounded-full bg-kk-lime flex items-center justify-center">
            <ShoppingCart size={30} className="text-kk-night" />
          </span>
          <span className="text-2xl font-display font-extrabold tracking-tight text-white mt-3">
            Müşteriyim
          </span>
          <span className="text-sm text-kk-muted mt-1">
            Fırsatları keşfet ve tasarruf et
          </span>
        </button>

        {/* Bouton Marchand */}
        <button
          onClick={() => navigate("/merchant/auth")}
          className="flex-1 max-h-[160px] rounded-3xl bg-white/5 border border-white/10 flex flex-col items-center justify-center transition-transform active:scale-[0.98] active:bg-white/10"
        >
          <span className="w-16 h-16 rounded-full bg-kk-mint flex items-center justify-center">
            <Store size={30} className="text-kk-night" />
          </span>
          <span className="text-2xl font-display font-extrabold tracking-tight text-white mt-3">
            İşletmeyim
          </span>
          <span className="text-sm text-kk-muted mt-1">
            Ürünlerini sat, israfı önle
          </span>
        </button>
      </div>
    </div>
  );
};

export default UserTypeSelectionPage;
