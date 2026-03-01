import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { ReactNode, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

interface MainLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export default function MainLayout({ children, title = "Dashboard", subtitle }: MainLayoutProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  // 1. Lifted state for mobile menu
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    if (user?.id) {
      queryClient.invalidateQueries(); 
    }
  }, [user?.id, queryClient]);

  return (
    <div className="h-[100dvh] w-full flex bg-gradient-to-br from-slate-100 to-gray-100 font-sans text-slate-900 overflow-hidden">
      
      {/* 2. Pass state to Sidebar */}
      <Sidebar isMobileOpen={isMobileOpen} setIsMobileOpen={setIsMobileOpen} />
      
      <main className="flex-1 h-[100dvh] flex flex-col relative z-0 ml-0 lg:ml-64 transition-all duration-300 ease-in-out">
        <div className="flex-1 overflow-y-auto max-h-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] relative">
          
          {/* 3. Pass toggle function to Header (and removed the pl-14 wrapper) */}
          <Header 
            title={title} 
            subtitle={subtitle} 
            onMenuToggle={() => setIsMobileOpen(true)} 
          />
          
            <div className="p-4 pb-8 md:p-8 max-w-7xl mx-auto w-full space-y-6 md:space-y-8 
                          animate-in fade-in duration-500 slide-in-from-bottom-4">
            {children}
          </div>

        </div>
      </main>
    </div>
  );
}