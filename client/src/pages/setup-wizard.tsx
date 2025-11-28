import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, CheckCircle, UserCog, Lock, Server, ArrowRight } from "lucide-react";

const adminSetupSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
  email: z.string().email("Invalid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type AdminSetupForm = z.infer<typeof adminSetupSchema>;

export default function SetupWizard() {
  const [isComplete, setIsComplete] = useState(false);

  const form = useForm<AdminSetupForm>({
    resolver: zodResolver(adminSetupSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
      email: "",
      firstName: "",
      lastName: "",
    },
  });

  const setupMutation = useMutation({
    mutationFn: async (data: AdminSetupForm) => {
      const { confirmPassword, ...adminData } = data;
      const response = await fetch("/api/setup/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...adminData,
          role: "admin",
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to create admin account");
      }

      return response.json();
    },
    onSuccess: () => {
      setIsComplete(true);
    },
  });

  const onSubmit = (data: AdminSetupForm) => {
    setupMutation.mutate(data);
  };

  if (isComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50 relative overflow-hidden">
        {/* Background Decoration */}
        <div className="absolute top-0 left-0 w-full h-full bg-white/50 backdrop-blur-3xl z-0" />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
        
        <Card className="w-full max-w-md relative z-10 bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-2xl rounded-3xl overflow-hidden">
          <CardContent className="pt-12 pb-12 px-8 text-center">
            <div className="mb-6 relative">
               <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto animate-in zoom-in duration-500">
                  <CheckCircle className="w-12 h-12 text-emerald-600" />
               </div>
               <div className="absolute inset-0 bg-emerald-400/20 rounded-full animate-ping opacity-20 delay-300 duration-1000" />
            </div>
            
            <h2 className="text-2xl font-bold text-slate-900 mb-2">System Setup Complete!</h2>
            <p className="text-slate-500 mb-8">
              Your administrator account has been successfully created. You are ready to configure the workforce.
            </p>

            <Button
              className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.02]"
              onClick={() => window.location.href = "/auth"}
            >
              Proceed to Login <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans text-slate-900 relative overflow-hidden">
       {/* Background Blobs */}
       <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-200/20 rounded-full blur-[100px] pointer-events-none" />
       <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-rose-200/20 rounded-full blur-[100px] pointer-events-none" />

       <div className="container mx-auto flex items-center justify-center p-4 md:p-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 w-full max-w-6xl items-center">
             
             {/* Left Side: Intro & Bento Features */}
             <div className="hidden lg:block space-y-8">
                <div>
                   <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 mb-4">
                      Welcome to <span className="text-blue-600">ESSence</span>
                   </h1>
                   <p className="text-lg text-slate-600 leading-relaxed max-w-md">
                      Let's get your organization set up. Create your root administrator account to begin managing your workforce.
                   </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="bg-white/60 backdrop-blur-md border border-white/20 p-5 rounded-2xl shadow-sm">
                      <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-3">
                         <Shield className="w-5 h-5" />
                      </div>
                      <h3 className="font-semibold text-slate-800">Root Access</h3>
                      <p className="text-xs text-slate-500 mt-1">Full control over system settings and user roles.</p>
                   </div>
                   <div className="bg-white/60 backdrop-blur-md border border-white/20 p-5 rounded-2xl shadow-sm">
                      <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 mb-3">
                         <UserCog className="w-5 h-5" />
                      </div>
                      <h3 className="font-semibold text-slate-800">User Management</h3>
                      <p className="text-xs text-slate-500 mt-1">Onboard managers, HR, and employees easily.</p>
                   </div>
                   <div className="bg-white/60 backdrop-blur-md border border-white/20 p-5 rounded-2xl shadow-sm col-span-2 flex items-center gap-4">
                      <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 flex-shrink-0">
                         <Server className="w-5 h-5" />
                      </div>
                      <div>
                         <h3 className="font-semibold text-slate-800">Centralized Database</h3>
                         <p className="text-xs text-slate-500">Secure storage for all organizational data.</p>
                      </div>
                   </div>
                </div>
             </div>

             {/* Right Side: Setup Form */}
             <Card className="w-full bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-2xl rounded-3xl">
                <CardHeader className="space-y-1 text-center pb-8 pt-10">
                   <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-slate-900/20">
                      <Lock className="w-8 h-8 text-white" />
                   </div>
                   <CardTitle className="text-2xl font-bold">Create Admin Account</CardTitle>
                   <CardDescription>This account will have full system privileges</CardDescription>
                </CardHeader>
                <CardContent className="px-8 pb-10">
                   <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                      <div className="grid grid-cols-2 gap-5">
                         <div className="space-y-2">
                            <Label htmlFor="firstName">First Name</Label>
                            <Input id="firstName" {...form.register("firstName")} className="rounded-xl bg-white/50 border-slate-200 focus:ring-blue-500/20" placeholder="Jane" />
                            {form.formState.errors.firstName && <p className="text-xs text-red-500">{form.formState.errors.firstName.message}</p>}
                         </div>
                         <div className="space-y-2">
                            <Label htmlFor="lastName">Last Name</Label>
                            <Input id="lastName" {...form.register("lastName")} className="rounded-xl bg-white/50 border-slate-200 focus:ring-blue-500/20" placeholder="Doe" />
                            {form.formState.errors.lastName && <p className="text-xs text-red-500">{form.formState.errors.lastName.message}</p>}
                         </div>
                      </div>

                      <div className="space-y-2">
                         <Label htmlFor="email">Email Address</Label>
                         <Input id="email" type="email" {...form.register("email")} className="rounded-xl bg-white/50 border-slate-200 focus:ring-blue-500/20" placeholder="admin@company.com" />
                         {form.formState.errors.email && <p className="text-xs text-red-500">{form.formState.errors.email.message}</p>}
                      </div>

                      <div className="space-y-2">
                         <Label htmlFor="username">Username</Label>
                         <Input id="username" {...form.register("username")} className="rounded-xl bg-white/50 border-slate-200 focus:ring-blue-500/20" placeholder="admin" />
                         {form.formState.errors.username && <p className="text-xs text-red-500">{form.formState.errors.username.message}</p>}
                      </div>

                      <div className="grid grid-cols-2 gap-5">
                         <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input id="password" type="password" {...form.register("password")} className="rounded-xl bg-white/50 border-slate-200 focus:ring-blue-500/20" placeholder="••••••" />
                            {form.formState.errors.password && <p className="text-xs text-red-500">{form.formState.errors.password.message}</p>}
                         </div>
                         <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm Password</Label>
                            <Input id="confirmPassword" type="password" {...form.register("confirmPassword")} className="rounded-xl bg-white/50 border-slate-200 focus:ring-blue-500/20" placeholder="••••••" />
                            {form.formState.errors.confirmPassword && <p className="text-xs text-red-500">{form.formState.errors.confirmPassword.message}</p>}
                         </div>
                      </div>

                      <Button 
                         type="submit" 
                         className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-lg shadow-slate-900/20 mt-4"
                         disabled={setupMutation.isPending}
                      >
                         {setupMutation.isPending ? "Creating System..." : "Complete Setup"}
                      </Button>
                   </form>
                </CardContent>
             </Card>
          </div>
       </div>
    </div>
  );
}