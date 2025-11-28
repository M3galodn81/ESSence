import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900 relative overflow-hidden">
      
      {/* Decorative Background Elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-rose-500/5 rounded-full blur-[100px] pointer-events-none" />

      <Card className="w-full max-w-md mx-4 bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-2xl rounded-3xl relative z-10">
        <CardContent className="pt-12 pb-12 px-8 text-center">
          <div className="h-24 w-24 bg-rose-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-sm border border-rose-100 transform rotate-3 hover:rotate-0 transition-transform duration-500 ease-out">
            <AlertCircle className="h-10 w-10 text-rose-500" />
          </div>
          
          <h1 className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">Page Not Found</h1>
          
          <p className="text-slate-500 text-sm leading-relaxed mb-8 max-w-xs mx-auto">
            The page you are looking for doesn't exist, has been moved, or you do not have permission to view it.
          </p>

          <Link href="/">
            <Button className="rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20 px-8 h-12 font-medium transition-all hover:scale-105 active:scale-95">
               <Home className="w-4 h-4 mr-2" />
               Return to Dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}