const Footer = () => (
  <footer className="nav-corporate mt-auto">
    <div className="gold-bar" />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2">
      <span className="text-sm text-muted-foreground">
        © {new Date().getFullYear()} SafeOne Security Company — Intranet Corporativa
      </span>
      <span className="text-xs text-muted-foreground">
        Departamento de Tecnología y Monitoreo
      </span>
    </div>
  </footer>
);

export default Footer;
