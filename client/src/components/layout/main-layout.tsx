import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { ReactNode, useEffect } from "react"; // 1. Import useEffect
import { useQueryClient } from "@tanstack/react-query"; // 2. Import QueryClient

interface MainLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export default function MainLayout({ children, title = "Dashboard", subtitle }: MainLayoutProps) {
  // 3. Get the query client instance
  const queryClient = useQueryClient();

  // 4. Set up the Auto-Refresh interval
  useEffect(() => {
    const intervalId = setInterval(() => {
      // This forces ALL queries in your app to check for new data
      // It happens in the background without flickering the screen
      queryClient.invalidateQueries(); 
    }, 5000); // <-- 5000ms = 5 seconds. Change this to adjust speed.

    // Cleanup interval when component unmounts
    return () => clearInterval(intervalId);
  }, [queryClient]);

  return (
    // Added h-screen and overflow-hidden here to lock the viewport
    <div className="h-screen w-full flex bg-gradient-to-br from-slate-100 to-gray-100 font-sans text-slate-900 overflow-hidden">
      
      <Sidebar />
      
      {/* Ensure the main container is also locked to screen height */}
      <main className="flex-1 h-screen flex flex-col relative z-0 ml-0 lg:ml-64 transition-all duration-300 ease-in-out">
        
        {/* This is the key container. 
          Adding 'max-h-full' and 'overflow-y-auto' ensures that only this 
          div scrolls if {children} expands, without resizing the whole layout.
        */}
        <div className="flex-1 overflow-y-auto max-h-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] relative">
          
          {/* Sticky Header */}
          <Header title={title} subtitle={subtitle} />
          
          <div className="p-4 md:p-1 max-w-7xl mx-auto w-full space-y-8 animate-in fade-in duration-500 slide-in-from-bottom-4">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}