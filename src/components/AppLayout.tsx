import AppSidebar from "@/components/AppSidebar";
import NotificationPermissionBanner from "@/components/NotificationPermissionBanner";
import { ReactNode } from "react";

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto">{children}</main>
      <NotificationPermissionBanner />
    </div>
  );
};

export default AppLayout;
