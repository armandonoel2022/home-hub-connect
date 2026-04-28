import logo from "@/assets/safeone-logo.png";
import GlobalSearch from "@/components/GlobalSearch";
import { Shield } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const Navbar = () => {
  const { user } = useAuth();

  return (
    <nav className="nav-corporate sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-3 shrink-0">
            <img src={logo} alt="SafeOne Security Company" className="h-10 w-auto" />
            <div className="hidden sm:block">
              <span className="font-heading font-bold text-lg text-secondary-foreground tracking-wide">
                SAFE<span className="gold-accent-text">ONE</span>
              </span>
              <span className="block text-xs text-muted-foreground -mt-1 tracking-widest">INTRANET</span>
            </div>
          </NavLink>

          {/* Search */}
          <div className="flex-1 max-w-xs">
            <GlobalSearch />
          </div>

          {/* Admin shortcuts */}
          {user?.isAdmin && (
            <NavLink
              to="/auditoria"
              className={({ isActive }) =>
                `hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  isActive
                    ? "bg-gold text-charcoal-dark border-gold"
                    : "border-border text-secondary-foreground hover:bg-charcoal-light hover:text-gold"
                }`
              }
              title="Bitácora de auditoría del sistema"
            >
              <Shield className="h-3.5 w-3.5" />
              Auditoría
            </NavLink>
          )}
        </div>
      </div>
      <div className="gold-bar" />
    </nav>
  );
};

export default Navbar;
