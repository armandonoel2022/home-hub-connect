import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import HeroBanner from "@/components/HeroBanner";
import DepartmentGrid from "@/components/DepartmentGrid";
import QuickLinks from "@/components/QuickLinks";
import Announcements from "@/components/Announcements";
import Footer from "@/components/Footer";
import { Building2, Calculator } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <HeroBanner />

        {/* System Access Buttons */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 w-full pt-8 pb-2">
          <div className="flex gap-3">
            <button
              onClick={() => navigate("/general")}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-heading font-bold text-sm text-secondary-foreground transition-all hover:brightness-110 hover:-translate-y-0.5"
              style={{ background: "var(--gradient-dark)" }}
            >
              <Building2 className="h-4 w-4" />
              General
            </button>
            <button
              onClick={() => navigate("/adonis")}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-heading font-bold text-sm text-primary-foreground transition-all hover:brightness-110 hover:-translate-y-0.5"
              style={{ background: "var(--gradient-gold)" }}
            >
              <Calculator className="h-4 w-4" />
              Adonis
            </button>
          </div>
        </section>

        <DepartmentGrid />
        <QuickLinks />
        <Announcements />
        <Footer />
      </div>
    </AppLayout>
  );
};

export default Index;
