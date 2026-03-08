import logo from "@/assets/safeone-logo.png";
import { Bell, Search, User, Menu, X } from "lucide-react";
import { useState } from "react";

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="nav-corporate sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img src={logo} alt="SafeOne Security Company" className="h-10 w-auto" />
            <div className="hidden sm:block">
              <span className="font-heading font-bold text-lg text-secondary-foreground tracking-wide">
                SAFE<span className="gold-accent-text">ONE</span>
              </span>
              <span className="block text-xs text-muted-foreground -mt-1 tracking-widest">INTRANET</span>
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg text-muted-foreground hover:text-gold transition-colors">
              <Bell className="h-5 w-5" />
            </button>
            <button className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg text-muted-foreground hover:text-gold transition-colors">
              <User className="h-5 w-5" />
              <span className="text-sm">Mi Perfil</span>
            </button>
            <button
              className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-gold transition-colors"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden px-4 pb-4">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-charcoal-light text-secondary-foreground placeholder:text-muted-foreground text-sm border-0 outline-none"
            />
          </div>
        </div>
      )}
      <div className="gold-bar" />
    </nav>
  );
};

export default Navbar;
