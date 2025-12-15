import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  needsSetup: boolean;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, InsertUser>;
};

type LoginData = Pick<InsertUser, "username" | "password">;

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  
  // Existing Queries
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const {
    data: setupData,
    isLoading: setupLoading,
  } = useQuery<{ needsSetup: boolean }, Error>({
    queryKey: ["/api/setup/check"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const needsSetup = setupData?.needsSetup ?? false;

  // 🟢 Login Mutation: ADD INVALIDATION HERE
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      // 1. Set the authenticated user data
      queryClient.setQueryData(["/api/user"], user);
      
      // 2. 🟢 AUTO-REFRESH CRITICAL DATA 🟢
      // Invalidate queries used by the LeaveManagement component and any general user data.
      // This forces React Query to refetch these data sets, ensuring the UI is fresh.
      queryClient.invalidateQueries({ queryKey: ["/api/leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leave-requests/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/"] });

      toast({
        title: "Login successful 🎉",
        description: `Welcome back, ${user.firstName}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: `Invalid username or password.`,
        variant: "destructive",
      });
    },
  });

  // Registration Mutation (Refreshes user data implicitly via setQueryData)
  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      const res = await apiRequest("POST", "/api/register", credentials);
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
      // 💡 It's usually safe to assume fresh data immediately after registration,
      // but you might want to invalidate other keys here too if needed.
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 🟢 Logout Mutation: ADD INVALIDATION HERE
  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      // 1. Clear the authenticated user data
      queryClient.setQueryData(["/api/user"], null);

      // 2. 🟢 CLEAR ALL USER-SPECIFIC DATA 🟢
      // This is crucial to prevent showing old, sensitive data to the next user.
      queryClient.resetQueries({ queryKey: ["/api/leave-requests"], exact: false });
      queryClient.resetQueries({ queryKey: ["/api/users/"], exact: false });

      toast({
        title: "Logout successful 👋",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading: isLoading || setupLoading,
        error,
        needsSetup,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}