import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Phone, Mail, Building, User } from "lucide-react";
import ExportMenu from "@/components/ExportMenu";
import { useState } from "react";
import { DEPARTMENTS } from "@/lib/types";

const DirectoryPage = () => {
  const { allUsers } = useAuth();
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");

  const filtered = allUsers.filter((u) => {
    const matchSearch =
      !search ||
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.position.toLowerCase().includes(search.toLowerCase()) ||
      (u.extension || "").includes(search);
    const matchDept = !filterDept || u.department === filterDept;
    return matchSearch && matchDept;
  });

  const grouped: Record<string, typeof filtered> = {};
  filtered.forEach((u) => {
    if (!grouped[u.department]) grouped[u.department] = [];
    grouped[u.department].push(u);
  });

  return (
    <AppLayout>
      <div className="min-h-screen">
        <div className="nav-corporate">
          <div className="gold-bar" />
          <div className="px-6 py-6">
            <div className="flex items-center gap-3">
              <Phone className="h-7 w-7 text-gold" />
              <div>
                <h1 className="font-heading font-bold text-2xl text-secondary-foreground">
                  Directorio <span className="gold-accent-text">Corporativo</span>
                </h1>
                <p className="text-muted-foreground text-sm mt-1">Contactos internos de SafeOne</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 flex flex-wrap gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nombre, email, cargo o extensión..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
            />
          </div>
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="px-4 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
          >
            <option value="">Todos los departamentos</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div className="px-6 pb-8 space-y-6">
          {Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([dept, users]) => (
              <div key={dept}>
                <div className="flex items-center gap-2 mb-3">
                  <Building className="h-4 w-4 text-gold" />
                  <h2 className="font-heading font-bold text-card-foreground">{dept}</h2>
                  <span className="text-xs text-muted-foreground">({users.length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {users.map((u) => (
                    <div key={u.id} className="bg-card rounded-lg border border-border p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                          {u.photoUrl ? (
                            <img src={u.photoUrl} alt={u.fullName} className="w-full h-full object-cover rounded-full" />
                          ) : (
                            <User className="h-6 w-6 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-heading font-semibold text-card-foreground text-sm truncate">{u.fullName}</h3>
                          <p className="text-xs text-muted-foreground truncate">{u.position}</p>
                          <div className="mt-2 space-y-1">
                            {u.extension && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                <span>Ext. {u.extension}</span>
                              </div>
                            )}
                            {u.fleetPhone && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3 text-gold" />
                                <span>{u.fleetPhone}</span>
                              </div>
                            )}
                            {u.email && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                <span className="truncate">{u.email}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <User className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No se encontraron contactos</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default DirectoryPage;
