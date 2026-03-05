import logo from "@/assets/safeone-logo.png";
import {
  LayoutDashboard,
  Ticket,
  Package,
  Truck,
  Shield,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useState } from "react";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Tickets IT", url: "/tickets", icon: Ticket },
  { title: "Inventario IT", url: "/inventario", icon: Package },
  { title: "Flotas", url: "/flotas", icon: Truck },
  { title: "Personal Armado", url: "/operaciones", icon: Shield },
];

const AppSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside
      className={`sticky top-0 h-screen flex flex-col transition-all duration-300 ${
        collapsed ? "w-[68px]" : "w-60"
      }`}
      style={{ background: "var(--gradient-dark)" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-charcoal-light">
        <img src={logo} alt="SafeOne" className="h-9 w-auto shrink-0" />
        {!collapsed && (
          <div className="overflow-hidden">
            <span className="font-heading font-bold text-sm text-secondary-foreground tracking-wide block">
              SAFE<span className="gold-accent-text">ONE</span>
            </span>
            <span className="text-[10px] text-muted-foreground tracking-widest">INTRANET</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.url;
          return (
            <NavLink
              key={item.url}
              to={item.url}
              end={item.url === "/"}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                isActive
                  ? "bg-charcoal-light text-gold font-semibold"
                  : "text-muted-foreground hover:text-secondary-foreground hover:bg-charcoal-light/50"
              }`}
              activeClassName=""
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.title}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center py-3 border-t border-charcoal-light text-muted-foreground hover:text-gold transition-colors"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  );
};

export default AppSidebar;
