import logo from "@/assets/safeone-logo.png";
import GlobalSearch from "@/components/GlobalSearch";

const Navbar = () => {
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

          {/* Search */}
          <div className="w-full max-w-xs">
            <GlobalSearch />
          </div>
        </div>
      </div>
      <div className="gold-bar" />
    </nav>
  );
};

export default Navbar;
