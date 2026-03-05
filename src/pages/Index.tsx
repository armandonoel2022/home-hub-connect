import Navbar from "@/components/Navbar";
import HeroBanner from "@/components/HeroBanner";
import DepartmentGrid from "@/components/DepartmentGrid";
import QuickLinks from "@/components/QuickLinks";
import Announcements from "@/components/Announcements";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <HeroBanner />
      <DepartmentGrid />
      <QuickLinks />
      <Announcements />
      <Footer />
    </div>
  );
};

export default Index;
