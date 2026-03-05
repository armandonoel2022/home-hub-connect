import logo from "@/assets/safeone-logo.png";
import {
  LayoutDashboard,
  Ticket,
  Package,
  Truck,
  Smartphone,
  Shield,
  FileCheck,
  ShoppingCart,
  Users,
  UserCog,
  Bell,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Tickets IT", url: "/tickets", icon: Ticket },
  { title: "Inventario IT", url: "/inventario", icon: Package },
  { title: "Flotilla Vehicular", url: "/flotilla", icon: Truck },
  { title: "Flota Celular", url: "/flota-celular", icon: Smartphone },
  { title: "Personal Armado", url: "/operaciones", icon: Shield },
  { title: "Solicitudes Compra", url: "/solicitudes-compra", icon: ShoppingCart },
  { title: "Solicitudes Personal", url: "/solicitudes-personal", icon: Users },
  { title: "BASC", url: "/basc", icon: FileCheck },
];

const adminItems = [
  { title: "Gestión Usuarios", url: "/admin/usuarios", icon: UserCog },
];

const AppSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  return (
    <aside
      className={`sticky top-0 h-screen flex flex-col transition-all duration-300 shrink-0 ${
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

      {/* User greeting + notification bell */}
      {user && !collapsed && (
        <div className="px-4 py-3 border-b border-charcoal-light">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Bienvenido,</p>
              <p className="text-sm font-heading font-semibold text-secondary-foreground truncate">{user.fullName}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user.department}</p>
            </div>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-lg text-muted-foreground hover:text-gold hover:bg-charcoal-light/50 transition-colors"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Notification bell for collapsed */}
      {user && collapsed && (
        <div className="flex justify-center py-3 border-b border-charcoal-light">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg text-muted-foreground hover:text-gold hover:bg-charcoal-light/50 transition-colors"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Notification Panel */}
      {showNotifications && (
        <div className="absolute left-full top-0 ml-2 w-80 max-h-[80vh] bg-card rounded-xl shadow-2xl border border-border z-50 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="font-heading font-bold text-card-foreground">Notificaciones</h3>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="text-xs gold-accent-text hover:underline">
                Marcar todas como leídas
              </button>
            )}
          </div>
          <div className="overflow-y-auto max-h-[60vh]">
            {notifications.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">Sin notificaciones</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    markAsRead(n.id);
                    navigate(n.actionUrl);
                    setShowNotifications(false);
                  }}
                  className={`w-full text-left p-4 border-b border-border hover:bg-muted/50 transition-colors ${!n.read ? "bg-gold/5" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!n.read ? "bg-gold" : "bg-transparent"}`} />
                    <div>
                      <p className="text-sm font-medium text-card-foreground">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
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

      {/* Logout */}
      {user && (
        <button
          onClick={logout}
          className="flex items-center gap-3 mx-2 mb-2 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-charcoal-light/50 transition-all"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Cerrar Sesión</span>}
        </button>
      )}

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
