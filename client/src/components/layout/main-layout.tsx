import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { ReactNode, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth"; // 1. Import useAuth

interface MainLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export default function MainLayout({ children, title = "Dashboard", subtitle }: MainLayoutProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth(); // 2. Get the current user

  // 3. Refresh queries ONLY when the user ID is populated (after login)
  useEffect(() => {
    if (user?.id) {
      queryClient.invalidateQueries(); 
    }
  }, [user?.id, queryClient]); // This runs once when user.id changes from undefined -> string

  return (
    <div className="h-screen w-full flex bg-gradient-to-br from-slate-100 to-gray-100 font-sans text-slate-900 overflow-hidden">
      
      <Sidebar />
      
      <main className="flex-1 h-screen flex flex-col relative z-0 ml-0 lg:ml-64 transition-all duration-300 ease-in-out">
        
        <div className="flex-1 overflow-y-auto max-h-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] relative">
          
          <Header title={title} subtitle={subtitle} />
          
          <div className="p-4 md:p-1 max-w-7xl mx-auto w-full space-y-8 animate-in fade-in duration-500 slide-in-from-bottom-4">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}