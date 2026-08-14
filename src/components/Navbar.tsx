import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const links = [
  { to: "/", icon: "🏠", label: "Home" },
  { to: "/find", icon: "🔎", label: "Find" },
  { to: "/map", icon: "🗺️", label: "Map" },
  { to: "/leaderboard", icon: "🏆", label: "Ranks" },
  { to: "/add", icon: "📷", label: "Add" },
];

export default function Navbar() {
  const { pathname } = useLocation();
  const { user, profile } = useAuth();
  const [pressed, setPressed] = useState<string | null>(null);

  return (
    <>
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#1a4731] text-white flex items-center justify-between px-4 py-3 shadow-md">
        <Link
          to="/"
          className="flex items-center gap-2 font-display font-semibold text-lg tracking-tight transition-transform active:scale-95"
        >
          <span
            className="text-2xl inline-block transition-transform duration-300 hover:rotate-12"
          >
            🌿
          </span>
          <span>CampusFlora</span>
        </Link>
        <div className="flex items-center gap-2">
          {profile?.role === "admin" && (
            <Link
              to="/admin"
              className="text-sm flex items-center gap-1 bg-[#95d5b2] text-[#1a4731] hover:bg-white active:scale-95 transition-all duration-150 px-3 py-1.5 rounded-full font-medium"
            >
              <span>⚙️</span>
              <span className="hidden sm:inline">Admin</span>
            </Link>
          )}
          <Link
            to={user ? "/contributions" : "/auth"}
            className="text-sm flex items-center gap-1 bg-[#2d6a4f] hover:bg-[#52b788] active:scale-95 transition-all duration-150 px-3 py-1.5 rounded-full font-medium"
          >
            {user ? (
              <>
                <span>👤</span>
                <span className="hidden sm:inline">{profile?.name ?? "Me"}</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </Link>
        </div>
      </header>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#d8f3dc] flex">
        {links.map((l) => {
          const active = pathname === l.to;
          const isPressed = pressed === l.to;

          return (
            <Link
              key={l.to}
              to={l.to}
              onPointerDown={() => setPressed(l.to)}
              onPointerUp={() => setPressed(null)}
              onPointerLeave={() => setPressed(null)}
              className={`relative flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium select-none
                transition-all duration-150
                ${active ? "text-[#2d6a4f]" : "text-[#95d5b2]"}
                ${isPressed ? "scale-90 opacity-70" : "scale-100 opacity-100"}
              `}
              style={{
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {/* Ripple background on press */}
              <span
                className={`absolute inset-0 rounded-xl mx-1 transition-all duration-200
                  ${isPressed ? "bg-[#d8f3dc] opacity-100" : "opacity-0"}
                `}
              />

              {/* Active pill indicator */}
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 bg-[#2d6a4f] rounded-b-full transition-all duration-300" />
              )}

              {/* Icon with bounce on active */}
              <span
                className={`text-xl relative z-10 transition-transform duration-200
                  ${active ? "scale-110" : "scale-100"}
                  ${isPressed ? "scale-125" : ""}
                `}
              >
                {l.icon}
              </span>

              <span
                className={`relative z-10 transition-all duration-200
                  ${active ? "font-semibold" : ""}
                  ${isPressed ? "text-[#2d6a4f]" : ""}
                `}
              >
                {l.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
