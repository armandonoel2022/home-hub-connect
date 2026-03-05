import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import HeroBanner from "@/components/HeroBanner";
import DepartmentGrid from "@/components/DepartmentGrid";
import QuickLinks from "@/components/QuickLinks";
import Announcements from "@/components/Announcements";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <HeroBanner />
        <DepartmentGrid />
        <QuickLinks />
        <Announcements />
        <Footer />
      </div>
    </AppLayout>
  );
};

export default Index;
