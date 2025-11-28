import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { ReactNode } from "react";

interface MainLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export default function MainLayout({ children, title = "Dashboard", subtitle }: MainLayoutProps) {
  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-white to-gray-100 font-sans text-slate-900">
      {/* Sidebar is assumed to be fixed or sticky */}
      <Sidebar />
      
      <main className="flex-1 flex flex-col overflow-hidden ml-0 lg:ml-64 transition-all duration-300 ease-in-out relative z-0">
        
        {/* Main Content Area - Scrollbar hidden */}
        {/* The Header is now INSIDE this scrollable container. 
            This allows content to scroll BEHIND the sticky glass header. */}
        <div className="flex-1 overflow-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] relative">
          
          {/* Header stays at the top of this container (sticky) */}
          <Header title={title} subtitle={subtitle} />
          
          <div className="p-4 md:p-6 max-w-7xl mx-auto w-full space-y-8 animate-in fade-in duration-500 slide-in-from-bottom-4">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}