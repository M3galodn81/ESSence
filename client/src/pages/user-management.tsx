import { useState, useEffect, useDeferredValue } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  UserPlus,
  Users,
  Shield,
  Edit,
  Trash2,
  Key,
  Briefcase,
  AlertTriangle,
  UserCog,
  UserCheck,
  Search
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BentoCard } from "@/components/custom/bento-card";

// ... [Schemas remain unchanged] ...
const createUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email("Invalid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["employee", "manager","payroll_officer"]),
  department: z.string().optional(),
  position: z.string().optional(),
  employeeId: z.string().optional(),
  phoneNumber: z.string().optional(),
  managerId: z.string().optional(),
});

const editUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["employee", "manager", "admin","payroll_officer"]),
  department: z.string().optional(),
  position: z.string().optional(),
  employeeId: z.string().optional(),
  phoneNumber: z.string().optional(),
  managerId: z.string().optional(),
  
  annualLeaveBalanceLimit: z.string().optional(),
  sickLeaveBalanceLimit: z.string().optional(),
  serviceIncentiveLeaveBalanceLimit: z.string().optional(),
});

const changePasswordSchema = z.object({
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type CreateUserForm = z.infer<typeof createUserSchema>;
type EditUserForm = z.infer<typeof editUserSchema>;
type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

export default function UserManagement() {
  const { user } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isDemotionAlertOpen, setIsDemotionAlertOpen] = useState(false);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const deferredQuery = useDeferredValue(searchQuery);

  const createForm = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      username: "",
      password: "",
      email: "",
      firstName: "",
      lastName: "",
      role: "employee",
      department: "",
      position: "",
      employeeId: "",
      phoneNumber: "",
      managerId: "",
    },
  });

  const watchedCreateRole = createForm.watch("role");

  const editForm = useForm<EditUserForm>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
       annualLeaveBalanceLimit: "",
       sickLeaveBalanceLimit: "",
       serviceIncentiveLeaveBalanceLimit: "",
    }
  });

  const passwordForm = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["/api/users"],
    enabled: user?.role === "admin" || user?.role === "manager",
  });

  const filteredUsers = users.filter((u: any) => {
    const searchStr = `${u.firstName} ${u.lastName} ${u.email} ${u.employeeId} ${u.username}`.toLowerCase();
    return searchStr.includes(deferredQuery.toLowerCase());
  });

  const managers = users.filter((u: any) => u.role === "manager");

  useEffect(() => {
    if (isCreateDialogOpen && users.length > 0) {
      const generateNextEmployeeId = (role: string) => {
        let prefix = "EMP";
        if (role === "manager") prefix = "MAN";
        if (role === "admin") prefix = "ADM";
        if (role === "payroll_officer") prefix = "PAY";

        const existingIds = users
          .map((u: any) => u.employeeId)
          .filter((id: string) => id && id.startsWith(prefix));

        let maxNum = 0;
        existingIds.forEach((id: string) => {
          const parts = id.split("-");
          if (parts.length === 2) {
            const num = parseInt(parts[1], 10);
            if (!isNaN(num) && num > maxNum) {
              maxNum = num;
            }
          }
        });

        const nextNum = (maxNum + 1).toString().padStart(3, "0");
        return `${prefix}-${nextNum}`;
      };

      const nextId = generateNextEmployeeId(watchedCreateRole);
      createForm.setValue("employeeId", nextId);
    }
  }, [watchedCreateRole, isCreateDialogOpen, users, createForm]);

  const createUserMutation = useMutation({
    mutationFn: async (data: CreateUserForm) => {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
            ...data,
            department: data.department || null,
            position: data.position || null,
            employeeId: data.employeeId || null,
            phoneNumber: data.phoneNumber || null,
            managerId: data.managerId || null,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to create user");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      toast.success("Success", { description: "User created successfully" });
    },
    onError: (error: Error) => {
      toast.error("Error", { description: error.message });
      
    },
  });

  const editUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EditUserForm }) => {
        const parseOptionalInt = (value: string | undefined): number | null => {
            if (value === undefined || value.trim() === "") return null;
            const parsed = parseInt(value, 10);
            return isNaN(parsed) ? null : parsed;
        };

        const cleanedData = {
            ...data,
            department: data.department || null,
            position: data.position || null,
            employeeId: data.employeeId || null,
            phoneNumber: data.phoneNumber || null,
            managerId: (data.role !== 'employee' || !data.managerId) ? null : data.managerId,
            annualLeaveBalanceLimit: parseOptionalInt(data.annualLeaveBalanceLimit),
            sickLeaveBalanceLimit: parseOptionalInt(data.sickLeaveBalanceLimit),
            serviceIncentiveLeaveBalanceLimit: parseOptionalInt(data.serviceIncentiveLeaveBalanceLimit),
        };
        
      const response = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(cleanedData),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to update user");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsEditDialogOpen(false);
      toast.success("Success", { description: "User updated successfully" });
    },
    onError: (error: Error) => {
      toast.error("Error", { description: error.message });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      const response = await fetch(`/api/users/${id}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to change password");
      }

      return response.json();
    },
    onSuccess: () => {
      setIsPasswordDialogOpen(false);
      passwordForm.reset();
      toast.success("Success", { description: "Password changed successfully" });
    },
    onError: (error: Error) => {
      toast.error("Error", { description: error.message });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/users/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to delete user");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsDeleteDialogOpen(false);
      toast.success("Success", { description: "User deleted successfully" });
    },
    onError: (error: Error) => {
      toast.error("Error", { description: error.message });
    },
  });

  const onCreateSubmit = (data: CreateUserForm) => {
    createUserMutation.mutate(data);
  };

  const onEditSubmit = (data: EditUserForm) => {
    if (!selectedUser) return;
    
    const isDemotingManager = selectedUser.role === 'manager' && data.role !== 'manager';
    const hasDirectReports = users.some((u: any) => u.managerId === selectedUser.id);

    if (isDemotingManager && hasDirectReports) {
        setIsDemotionAlertOpen(true);
        return;
    }
    
    editUserMutation.mutate({ id: selectedUser.id, data });
  };
    
  const handleConfirmedDemotion = () => {
      if (selectedUser) {
        const data = editForm.getValues();
        editUserMutation.mutate({ id: selectedUser.id, data });
      }
      setIsDemotionAlertOpen(false);
  };

  const onPasswordSubmit = (data: ChangePasswordForm) => {
    if (selectedUser) {
      changePasswordMutation.mutate({
        id: selectedUser.id,
        password: data.newPassword
      });
    }
  };

  const handleEdit = (userData: any) => {
    setSelectedUser(userData);
    editForm.reset({
      username: userData.username,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role,
      department: userData.department || "",
      position: userData.position || "",
      employeeId: userData.employeeId || "",
      phoneNumber: userData.phoneNumber || "",
      managerId: userData.managerId || "",
      annualLeaveBalanceLimit: userData.annualLeaveBalanceLimit?.toString() || "",
      sickLeaveBalanceLimit: userData.sickLeaveBalanceLimit?.toString() || "",
      serviceIncentiveLeaveBalanceLimit: userData.serviceIncentiveLeaveBalanceLimit?.toString() || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleChangePassword = (userData: any) => {
    setSelectedUser(userData);
    passwordForm.reset();
    setIsPasswordDialogOpen(true);
  };

  const handleDelete = (userData: any) => {
    setSelectedUser(userData);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedUser) {
      deleteUserMutation.mutate(selectedUser.id);
    }
  };

  const getAvailableRoles = () => {
    if (user?.role === "admin") {
      return [
        { value: "admin", label: "Admin" },
        { value: "manager", label: "Manager" },
        { value: "payroll_officer", label: "Payroll Officer" }, 
        { value: "employee", label: "Employee" },
      ];
    } else if (user?.role === "manager") {
      return [
        { value: "employee", label: "Employee" },
      ];
    }
    return [];
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      admin: "bg-rose-100 text-rose-700 border-rose-200",
      manager: "bg-purple-100 text-purple-700 border-purple-200",
      payroll_officer: "bg-blue-100 text-blue-700 border-blue-200",
      employee: "bg-emerald-100 text-emerald-700 border-emerald-200",
    };
    return <Badge variant="outline" className={`capitalize ${colors[role] || "bg-gray-100"} border px-2.5 py-0.5`}>{role.replace(/_/g, " ")}</Badge>;
  };
  
  const canModifyUser = (targetUser: any) => {
    if (user?.role === "admin") return true;
    if (user?.role === "manager") {
      if (user.id === targetUser.id) return true;
      if (targetUser.role === 'employee' && targetUser.managerId === user.id) return true;
    }
    return false;
  };

  const stats = {
    total: users.length,
    admins: users.filter((u: any) => u.role === 'admin').length,
    managers: users.filter((u: any) => u.role === 'manager').length,
    employees: users.filter((u: any) => u.role === 'employee').length,
  };

  if (user?.role !== "admin" && user?.role !== "manager") {
    return (
      <div className="p-8 flex justify-center items-center h-screen">
        <Card className="w-full max-w-md bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-lg rounded-3xl">
          <CardContent className="py-12 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                <Shield className="w-8 h-8" />
            </div>
            <p className="text-slate-500">You don't have permission to access user management.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">User Management</h1>
          <p className="text-slate-500 mt-1 text-sm">Create and manage user accounts and permissions</p>
        </div>

      <div className="flex flex-col sm:flex-row gap-3 items-center">
        {/* Search Bar */}
        <div className="relative w-full sm:w-64">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" /> 
          </div>
          <Input
            placeholder="Search users..."
            className="pl-10 rounded-full bg-white/60 border-slate-200/60 focus:bg-white transition-all shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) createForm.reset();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20 rounded-full px-6">
              <UserPlus className="w-4 h-4 mr-2" /> Create User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>Add a new user to the system</DialogDescription>
            </DialogHeader>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>First Name *</Label>
                  <Input {...createForm.register("firstName")} className="rounded-xl" />
                  {createForm.formState.errors.firstName && <p className="text-xs text-red-500 mt-1">{createForm.formState.errors.firstName.message}</p>}
                </div>
                <div>
                  <Label>Last Name *</Label>
                  <Input {...createForm.register("lastName")} className="rounded-xl" />
                  {createForm.formState.errors.lastName && <p className="text-xs text-red-500 mt-1">{createForm.formState.errors.lastName.message}</p>}
                </div>
              </div>
              <div>
                <Label>Email *</Label>
                <Input type="email" {...createForm.register("email")} className="rounded-xl" />
                {createForm.formState.errors.email && <p className="text-xs text-red-500 mt-1">{createForm.formState.errors.email.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Username *</Label>
                  <Input {...createForm.register("username")} className="rounded-xl" />
                  {createForm.formState.errors.username && <p className="text-xs text-red-500 mt-1">{createForm.formState.errors.username.message}</p>}
                </div>
                <div>
                  <Label>Password *</Label>
                  <Input type="password" {...createForm.register("password")} className="rounded-xl" />
                  {createForm.formState.errors.password && <p className="text-xs text-red-500 mt-1">{createForm.formState.errors.password.message}</p>}
                </div>
              </div>
              <div>
                <Label>Role *</Label>
                <Select onValueChange={(value) => createForm.setValue("role", value as any)} defaultValue="employee">
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {getAvailableRoles().map((role) => (
                      <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Department</Label>
                  <Input {...createForm.register("department")} className="rounded-xl" />
                </div>
                <div>
                  <Label>Position</Label>
                  <Input {...createForm.register("position")} className="rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <Label>Employee ID</Label>
                    <Input {...createForm.register("employeeId")} className="rounded-xl" />
                 </div>
                 <div>
                    <Label>Phone Number</Label>
                    <Input {...createForm.register("phoneNumber")} className="rounded-xl" />
                 </div>
              </div>
              {createForm.watch("role") === "employee" && (
                <div>
                  <Label>Manager (Optional)</Label>
                  <Select value={createForm.watch("managerId") || ""} onValueChange={(value) => createForm.setValue("managerId", value)}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select manager" /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {managers.length > 0 ? managers.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.firstName} {m.lastName}</SelectItem>) : <SelectItem value="none" disabled>No managers available</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="rounded-full">Cancel</Button>
                <Button type="submit" disabled={createUserMutation.isPending} className="rounded-full bg-slate-900">{createUserMutation.isPending ? "Creating..." : "Create User"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Bento Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <BentoCard title="Total Users" value={stats.total} icon={Users} variant="default" testIdPrefix="stat-total" />
        <BentoCard title="Employees" value={stats.employees} icon={UserCheck} variant="emerald" testIdPrefix="stat-employees" />
        <BentoCard title="Managers" value={stats.managers} icon={Briefcase} variant="rose" testIdPrefix="stat-managers" />
        <BentoCard title="Admins" value={stats.admins} icon={Shield} variant="amber" testIdPrefix="stat-admins" />
      </div>

      {/* Glass User Grid */}
      {usersLoading ? (
        <div className="text-center py-12 text-slate-400">Loading users...</div>
      ) : filteredUsers.length === 0 ? (
        // ADDED w-full here to fix the width issue
        <div className="w-full text-center py-20 bg-white/40 border border-dashed border-slate-200 rounded-3xl">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 mb-4">
            {searchQuery ? `No users found matching "${searchQuery}"` : "No users found."}
          </p>
          {searchQuery && (
            <Button 
              variant="outline" 
              onClick={() => setSearchQuery("")}
              className="rounded-full"
            >
              Clear Search
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map((u: any) => (
            <Card key={u.id} className="bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-sm hover:shadow-md transition-all rounded-2xl overflow-hidden group">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                      <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center text-lg font-bold text-slate-600 border border-slate-200">
                        {u.firstName.charAt(0)}{u.lastName.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">{u.firstName} {u.lastName}</h3>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                  </div>
                  {getRoleBadge(u.role)}
                </div>
                
                <div className="space-y-2 mb-6">
                   <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Position:</span>
                      <span className="font-medium text-slate-700">{u.position || "—"}</span>
                   </div>
                   <div className="flex justify-between text-sm">
                      <span className="text-slate-500">ID:</span>
                      <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{u.employeeId || "—"}</span>
                   </div>
                   <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Department:</span>
                      <span className="font-medium text-slate-700">{u.department || "—"}</span>
                   </div>
                </div>

                {(user?.role === "admin" || canModifyUser(u)) && (
                  <div className="flex items-center gap-2 pt-4 border-t border-slate-100/50 opacity-60 group-hover:opacity-100 transition-opacity">
                      <Button size="sm" variant="ghost" className="flex-1 h-8 bg-white border border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100 rounded-lg text-xs" onClick={() => handleEdit(u)}>
                        <Edit className="w-3.5 h-3.5 mr-1.5" /> Edit
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 bg-white border border-slate-200 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-100 rounded-lg" onClick={() => handleChangePassword(u)} title="Change Password">
                        <Key className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 rounded-lg" onClick={() => handleDelete(u)} disabled={u.id === user.id} title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => { setIsEditDialogOpen(open); if (!open) { editForm.reset(); setSelectedUser(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 mt-2">
             <div className="grid grid-cols-2 gap-4">
                <div><Label>First Name</Label><Input {...editForm.register("firstName")} className="rounded-xl" /></div>
                <div><Label>Last Name</Label><Input {...editForm.register("lastName")} className="rounded-xl" /></div>
             </div>
             <div><Label>Email</Label><Input {...editForm.register("email")} className="rounded-xl" /></div>
             <div><Label>Username</Label><Input {...editForm.register("username")} className="rounded-xl" /></div>
             <div>
                <Label>Role</Label>
                <Select value={editForm.watch("role")} onValueChange={(val) => editForm.setValue("role", val as any)}>
                   <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                   <SelectContent className="rounded-xl">
                      {getAvailableRoles().map((role) => <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>)}
                   </SelectContent>
                </Select>
             </div>
             <div className="grid grid-cols-2 gap-4">
                <div><Label>Department</Label><Input {...editForm.register("department")} className="rounded-xl" /></div>
                <div><Label>Position</Label><Input {...editForm.register("position")} className="rounded-xl" /></div>
             </div>
             <div className="grid grid-cols-2 gap-4">
                <div><Label>Employee ID</Label><Input {...editForm.register("employeeId")} className="rounded-xl" /></div>
                <div><Label>Phone</Label><Input {...editForm.register("phoneNumber")} className="rounded-xl" /></div>
             </div>

             <div className="space-y-3 pt-2 border-t border-slate-100">
                <h4 className="text-sm font-semibold text-slate-900">Leave Limits (Annual)</h4>
                <div className="grid grid-cols-2 gap-4">
                   <div><Label className="text-xs text-slate-500">Service Incentive Limit</Label><Input type="number" {...editForm.register("annualLeaveBalanceLimit")} className="rounded-xl" /></div>
                   <div><Label className="text-xs text-slate-500">Additional Benefit Limit</Label><Input type="number" {...editForm.register("sickLeaveBalanceLimit")} className="rounded-xl" /></div>
                </div>
             </div>

             {editForm.watch("role") === "employee" && (
                <div>
                   <Label>Manager</Label>
                   <Select value={editForm.watch("managerId") || ""} onValueChange={(val) => editForm.setValue("managerId", val)}>
                      <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select Manager" /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                          {managers.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.firstName} {m.lastName}</SelectItem>)}
                      </SelectContent>
                   </Select>
                </div>
             )}

             <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} className="rounded-full">Cancel</Button>
                <Button type="submit" disabled={editUserMutation.isPending} className="rounded-full bg-slate-900">Save Changes</Button>
             </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={(open) => { setIsPasswordDialogOpen(open); if (!open) passwordForm.reset(); }}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>Change Password</DialogTitle></DialogHeader>
          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
             <div><Label>New Password</Label><Input type="password" {...passwordForm.register("newPassword")} className="rounded-xl" /></div>
             <div><Label>Confirm Password</Label><Input type="password" {...passwordForm.register("confirmPassword")} className="rounded-xl" /></div>
             <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsPasswordDialogOpen(false)} className="rounded-full">Cancel</Button>
                <Button type="submit" disabled={changePasswordMutation.isPending} className="rounded-full bg-slate-900">Update Password</Button>
             </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => { setIsDeleteDialogOpen(open); if (!open) setSelectedUser(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-600"><AlertTriangle className="w-5 h-5" /> Delete User</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete <strong>{selectedUser?.firstName} {selectedUser?.lastName}</strong>? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="rounded-full bg-rose-600 hover:bg-rose-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Manager Demotion Alert Dialog */}
      <AlertDialog open={isDemotionAlertOpen} onOpenChange={setIsDemotionAlertOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600"><AlertTriangle className="w-5 h-5" /> Demotion Conflict</AlertDialogTitle>
            <AlertDialogDescription>This user is a manager for other employees. Please reassign their direct reports before demoting them.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Close</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmedDemotion} className="rounded-full bg-amber-600 hover:bg-amber-700">Proceed Anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}