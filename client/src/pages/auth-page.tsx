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
import { Building, Users, Shield, Clock } from "lucide-react";

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
    <div className="min-h-screen flex">
      {}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <div className="flex items-center justify-center mb-6">
              <img
                src="/images/logo.jpeg"
                alt="ESSence Self Service"
                className="w-48 h-48 object-cover rounded-full border-4 border-red-600 shadow-lg"
              />
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Welcome Back</CardTitle>
              <CardDescription>Sign in to access your employee portal</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    data-testid="input-username"
                    {...loginForm.register("username")}
                    placeholder="Enter your username"
                  />
                  {loginForm.formState.errors.username && (
                    <p className="text-sm text-destructive mt-1">
                      {loginForm.formState.errors.username.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    data-testid="input-password"
                    {...loginForm.register("password")}
                    placeholder="Enter your password"
                  />
                  {loginForm.formState.errors.password && (
                    <p className="text-sm text-destructive mt-1">
                      {loginForm.formState.errors.password.message}
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginMutation.isPending}
                  data-testid="button-login"
                >
                  {loginMutation.isPending ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {}
      <div className="hidden lg:flex lg:w-1/2 bg-primary items-center justify-center p-8">
        <div className="text-center text-primary-foreground max-w-lg">
          <h2 className="text-4xl font-bold mb-6">Streamline Your Workplace</h2>
          <p className="text-xl mb-8 opacity-90">
            Manage your employee journey with our comprehensive self-service portal
          </p>
          
          <div className="grid grid-cols-2 gap-6 text-left">
            <div className="flex items-start space-x-3">
              <Users className="w-8 h-8 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold mb-1">Team Management</h3>
                <p className="text-sm opacity-80">Collaborate effectively with your team</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Shield className="w-8 h-8 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold mb-1">Secure Access</h3>
                <p className="text-sm opacity-80">Role-based permissions and security</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Clock className="w-8 h-8 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold mb-1">Time Tracking</h3>
                <p className="text-sm opacity-80">Monitor schedules and attendance</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Building className="w-8 h-8 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold mb-1">Digital Workspace</h3>
                <p className="text-sm opacity-80">Everything you need in one place</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
