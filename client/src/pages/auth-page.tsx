import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building, Users, Shield, Clock, CheckCircle2 } from "lucide-react";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function AuthPage() {
  const { user, loginMutation } = useAuth();
  const [, navigate] = useLocation();

  const { data: setupStatus } = useQuery({
    queryKey: ["/api/setup/check"],
  });

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  useEffect(() => {
    if (setupStatus?.needsSetup) {
      navigate("/setup");
    }
  }, [setupStatus, navigate]);

  if (user) {
    return <Redirect to="/" />;
  }

  const onLogin = (data: LoginForm) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans text-slate-900">
      
      {/* Left Section: Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative overflow-hidden">
         {/* Decorative Background Elements */}
         <div className="absolute top-0 left-0 w-full h-full bg-white/50 backdrop-blur-3xl z-0"></div>
         <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-200/30 rounded-full blur-3xl mix-blend-multiply animate-blob"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl mix-blend-multiply animate-blob animation-delay-2000"></div>

        <div className="w-full max-w-md space-y-8 relative z-10">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="relative">
                 <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-emerald-600 rounded-full blur opacity-20"></div>
                 <img
                  src="/images/logo.jpeg"
                  alt="ESSence Self Service"
                  className="relative w-24 h-24 object-cover rounded-full border-4 border-white shadow-xl"
                />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Welcome Back</h1>
              <p className="text-slate-500 text-sm mt-1">Sign in to access your employee portal</p>
            </div>
          </div>

          <Card className="border-none shadow-2xl shadow-slate-200/50 bg-white/80 backdrop-blur-xl rounded-3xl">
            <CardContent className="pt-8 pb-8 px-8">
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-slate-600 font-medium text-sm ml-1">Username</Label>
                  <Input
                    id="username"
                    data-testid="input-username"
                    {...loginForm.register("username")}
                    placeholder="Enter your username"
                    className="h-12 rounded-xl bg-slate-50 border-slate-200 focus:border-blue-500/50 focus:ring-blue-500/20 transition-all"
                  />
                  {loginForm.formState.errors.username && (
                    <p className="text-xs text-red-500 font-medium ml-1">
                      {loginForm.formState.errors.username.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-600 font-medium text-sm ml-1">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    data-testid="input-password"
                    {...loginForm.register("password")}
                    placeholder="Enter your password"
                    className="h-12 rounded-xl bg-slate-50 border-slate-200 focus:border-blue-500/50 focus:ring-blue-500/20 transition-all"
                  />
                  {loginForm.formState.errors.password && (
                    <p className="text-xs text-red-500 font-medium ml-1">
                      {loginForm.formState.errors.password.message}
                    </p>
                  )}
                </div>
                
                <Button
                  type="submit"
                  className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-lg shadow-slate-900/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  disabled={loginMutation.isPending}
                  data-testid="button-login"
                >
                  {loginMutation.isPending ? (
                     <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Signing in...</span>
                     </div>
                  ) : "Sign In"}
                </Button>
              </form>
            </CardContent>
          </Card>
          
          <p className="text-center text-xs text-slate-400">
            © 2025 ESSence Self Service. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right Section: Bento Grid Features */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 relative overflow-hidden items-center justify-center p-12">
        {/* Background Gradients */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-500/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2"></div>
        
        <div className="relative z-10 max-w-xl w-full">
           <div className="mb-12 text-center">
             <h2 className="text-4xl font-bold text-white mb-4 tracking-tight">Streamline Your Workplace</h2>
             {/* <p className="text-slate-400 text-lg font-light">Manage your employee journey with our comprehensive self-service portal.</p> */}
           </div>

           <div className="grid grid-cols-2 gap-4">
              {/* Feature Card 1 */}
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 p-6 rounded-3xl hover:bg-white/10 transition-colors">
                 <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-4 text-blue-400">
                    <Users className="w-6 h-6" />
                 </div>
                 <h3 className="text-white font-semibold text-lg mb-1">Team Management</h3>
                 <p className="text-slate-400 text-sm leading-relaxed">Collaborate effectively with your team members.</p>
              </div>

              {/* Feature Card 2 */}
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 p-6 rounded-3xl hover:bg-white/10 transition-colors">
                 <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center mb-4 text-emerald-400">
                    <Shield className="w-6 h-6" />
                 </div>
                 <h3 className="text-white font-semibold text-lg mb-1">Secure Access</h3>
                 <p className="text-slate-400 text-sm leading-relaxed">Enterprise-grade security for your personal data.</p>
              </div>

              {/* Feature Card 3 */}
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 p-6 rounded-3xl hover:bg-white/10 transition-colors">
                 <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center mb-4 text-amber-400">
                    <Clock className="w-6 h-6" />
                 </div>
                 <h3 className="text-white font-semibold text-lg mb-1">Time Tracking</h3>
                 <p className="text-slate-400 text-sm leading-relaxed">Monitor schedules and attendance in real-time.</p>
              </div>

              {/* Feature Card 4 */}
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 p-6 rounded-3xl hover:bg-white/10 transition-colors">
                 <div className="w-12 h-12 bg-rose-500/20 rounded-2xl flex items-center justify-center mb-4 text-rose-400">
                    <Building className="w-6 h-6" />
                 </div>
                 <h3 className="text-white font-semibold text-lg mb-1">Digital Workspace</h3>
                 <p className="text-slate-400 text-sm leading-relaxed">Everything you need in one unified place.</p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}