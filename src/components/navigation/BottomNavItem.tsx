import React from "react";
import { LucideIcon } from "lucide-react";

interface BottomNavItemProps {
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

/**
 * Composant pour un onglet de la bottom navigation
 * Affiche une icône et un label avec état actif/inactif
 */
const BottomNavItem: React.FC<BottomNavItemProps> = ({
  icon: Icon,
  label,
  isActive,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center min-w-0 h-full transition-all duration-200 focus:outline-none active:bg-transparent ${
        isActive ? "flex-[2]" : "flex-1"
      }`}
      style={{
        WebkitTapHighlightColor: "transparent",
        outline: "none",
      }}
    >
      <span
        className={`flex items-center justify-center min-w-0 rounded-full transition-all duration-200 ${
          isActive
            ? "gap-1.5 bg-kk-lime text-kk-night px-4 py-2.5"
            : "text-white/70 p-2.5"
        }`}
      >
        <Icon
          className={`w-6 h-6 flex-shrink-0 ${isActive ? "stroke-[2.5px]" : "stroke-[1.75px]"}`}
        />
        <span
          className={`text-xs ${
            isActive ? "font-display font-extrabold truncate" : "sr-only"
          }`}
        >
          {label}
        </span>
      </span>
    </button>
  );
};

export default BottomNavItem;
