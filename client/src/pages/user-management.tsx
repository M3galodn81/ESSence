import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  UserPlus,
  Users,
  Shield,
  Edit,
  Trash2,
  Key,
  Eye,
  EyeOff,
  AlertTriangle
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
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

// 🟢 UPDATED SCHEMA: Removed current balance fields, keeping only limits
const editUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["employee", "manager", "admin"]),
  department: z.string().optional(),
  position: z.string().optional(),
  employeeId: z.string().optional(),
  phoneNumber: z.string().optional(),
  managerId: z.string().optional(),
  
  // Maximum Limits (Only these are editable)
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
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [isDemotionAlertOpen, setIsDemotionAlertOpen] = useState(false);

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
    // 🟢 Initializing only limit fields
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
    
  // Filter out managers for the employee creation/edit process
  const managers = users.filter((u: any) => u.role === "manager");

  const generateNextEmployeeId = (role: string) => {
    let prefix = "EMP";
    if (role === "manager") prefix = "MAN";
    if (role === "admin") prefix = "ADM";
    if (role === "payroll_officer") prefix = "PAY"; // Future proofing

    // Find all IDs that start with this prefix
    const existingIds = users
      .map((u: any) => u.employeeId)
      .filter((id: string) => id && id.startsWith(prefix));

    let maxNum = 0;
    existingIds.forEach((id: string) => {
      // Split "EMP-001" -> ["EMP", "001"]
      const parts = id.split("-");
      if (parts.length === 2) {
        const num = parseInt(parts[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });

    // Generate next number formatted with leading zeros (e.g., 005)
    const nextNum = (maxNum + 1).toString().padStart(3, "0");
    return `${prefix}-${nextNum}`;
  };

  useEffect(() => {
    if (isCreateDialogOpen && users.length > 0) {
      const nextId = generateNextEmployeeId(watchedCreateRole);
      createForm.setValue("employeeId", nextId);
    }
  }, [watchedCreateRole, isCreateDialogOpen, users, createForm.setValue]);

  const createUserMutation = useMutation({
    mutationFn: async (data: CreateUserForm) => {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        // 🟢 Clean up data: convert empty strings to null for optional fields
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
      toast({
        title: "Success",
        description: "User created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const editUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EditUserForm }) => {
        
        // Helper to convert optional string number to integer or null
        const parseOptionalInt = (value: string | undefined): number | null => {
            if (value === undefined || value.trim() === "") return null;
            const parsed = parseInt(value, 10);
            return isNaN(parsed) ? null : parsed;
        };

        // 🟢 Clean up data: convert empty strings to null for optional fields and parse numbers
        const cleanedData = {
            ...data,
            department: data.department || null,
            position: data.position || null,
            employeeId: data.employeeId || null,
            phoneNumber: data.phoneNumber || null,
            // Ensure managerId is null if employee role is changed to non-employee (Admin/Manager)
            managerId: (data.role !== 'employee' || !data.managerId) ? null : data.managerId,
            
            // 🟢 LEAVE BALANCES (Limit Only)
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
      toast({
        title: "Success",
        description: "User updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
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
      toast({
        title: "Success",
        description: "Password changed successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
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
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onCreateSubmit = (data: CreateUserForm) => {
    createUserMutation.mutate(data);
  };

  const onEditSubmit = (data: EditUserForm) => {
    if (!selectedUser) return;
    
    // Check for manager demotion conflict
    const isDemotingManager = selectedUser.role === 'manager' && data.role !== 'manager';
    const hasDirectReports = users.some((u: any) => u.managerId === selectedUser.id);

    if (isDemotingManager && hasDirectReports) {
        // Prevent submission and show alert if manager has reports
        setIsDemotionAlertOpen(true);
        return;
    }
    
    // Proceed with mutation
    editUserMutation.mutate({ id: selectedUser.id, data });
  };
    
  // Function to handle demotion after confirming the alert
  const handleConfirmedDemotion = () => {
      // Note: We expect the backend API to handle clearing managerId for direct reports
      // OR the mutation logic in editUserMutation needs to be robust (which it is now
      // by setting managerId to null if role is not employee).
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
      // managerId is set to "" if null, matching the Select component's requirement for a string value
      managerId: userData.managerId || "",

      // 🟢 LEAVE BALANCES (Limit Only): Populate the new limit fields.
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
        { value: "manager", label: "Manager" },
        { value: "payroll_officer", label: "Payroll Officer" }, // Admin can create Admin
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
      admin: "bg-red-600 text-white",
      manager: "bg-gray-500 text-white",
      payroll_officer: "bg-blue-400 text-white",
      employee: "bg-gray-300 text-gray-900",
    };
    return <Badge className={colors[role] || "bg-gray-100"}>{role.replace(/_/g, " ").toUpperCase()}</Badge>;
  };

  //move this to permissions.ts
  if (user?.role !== "admin" && user?.role !== "manager") {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              You don't have permission to access user management.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="w-8 h-8" />
            User Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Create and manage user accounts
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) {
            createForm.reset();
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="w-4 h-4 mr-2" />
              Create User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Add a new user to the system
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    {...createForm.register("firstName")}
                    placeholder="First name"
                  />
                  {createForm.formState.errors.firstName && (
                    <p className="text-sm text-destructive mt-1">
                      {createForm.formState.errors.firstName.message}
                  </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    {...createForm.register("lastName")}
                    placeholder="Last name"
                  />
                  {createForm.formState.errors.lastName && (
                    <p className="text-sm text-destructive mt-1">
                      {createForm.formState.errors.lastName.message}
                  </p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  {...createForm.register("email")}
                  placeholder="user@company.com"
                />
                {createForm.formState.errors.email && (
                  <p className="text-sm text-destructive mt-1">
                    {createForm.formState.errors.email.message}
                  </p>
                )}
                </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="username">Username *</Label>
                  <Input
                    id="username"
                    {...createForm.register("username")}
                    placeholder="username"
                  />
                  {createForm.formState.errors.username && (
                    <p className="text-sm text-destructive mt-1">
                      {createForm.formState.errors.username.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    {...createForm.register("password")}
                    placeholder="Enter password"
                  />
                  {createForm.formState.errors.password && (
                    <p className="text-sm text-destructive mt-1">
                      {createForm.formState.errors.password.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="role">Role *</Label>
                <Select
                  onValueChange={(value) => createForm.setValue("role", value as any)}
                  defaultValue="employee"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableRoles().map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {createForm.formState.errors.role && (
                  <p className="text-sm text-destructive mt-1">
                    {createForm.formState.errors.role.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    {...createForm.register("department")}
                    placeholder="Department"
                  />
                </div>
                <div>
                  <Label htmlFor="position">Position</Label>
                  <Input
                    id="position"
                    {...createForm.register("position")}
                    placeholder="Job position"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="employeeId">Employee ID</Label>
                  <Input
                    id="employeeId"
                    {...createForm.register("employeeId")}
                    placeholder="Autogenerated (e.g. EMP-001)"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Auto-generated based on role: {generateNextEmployeeId(watchedCreateRole)}
                  </p>
                </div>
                <div>
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    {...createForm.register("phoneNumber")}
                    placeholder="+63 XXX XXX XXXX"
                  />
                </div>
              </div>

              {createForm.watch("role") === "employee" && (
                <div>
                  <Label htmlFor="managerId">Manager</Label>
                  <Select
                    value={createForm.watch("managerId") || ""}
                    onValueChange={(value) => createForm.setValue("managerId", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select manager" />
                    </SelectTrigger>
                    <SelectContent>
                      {managers.map((manager: any) => (
                          <SelectItem key={manager.id} value={manager.id}>
                            {manager.firstName} {manager.lastName}
                          </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createUserMutation.isPending}>
                  {createUserMutation.isPending ? "Creating..." : "Create User"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            Manage system users and their roles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {usersLoading ? (
              <p className="text-center text-muted-foreground py-8">Loading users...</p>
            ) : users.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No users found
              </p>
            ) : (
              <div className="space-y-2">
                {users.map((u: any) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                        <Shield className="w-5 h-5 text-gray-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">
                          {u.firstName} {u.lastName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {u.email} • @{u.username}
                        </p>
                        {u.position && (
                          <p className="text-sm text-muted-foreground">
                            {u.position} {u.department && `• ${u.department}`}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getRoleBadge(u.role)}
                      {user?.role === "admin" && (
                        <div className="flex gap-1 ml-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(u)}
                            title="Edit User"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleChangePassword(u)}
                            title="Change Password"
                          >
                            <Key className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(u)}
                            title="Delete User"
                            disabled={u.id === user.id}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) {
          editForm.reset();
          setSelectedUser(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-firstName">First Name *</Label>
                <Input
                  id="edit-firstName"
                  {...editForm.register("firstName")}
                  placeholder="First name"
                />
                {editForm.formState.errors.firstName && (
                  <p className="text-sm text-destructive mt-1">
                    {editForm.formState.errors.firstName.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="edit-lastName">Last Name *</Label>
                <Input
                  id="edit-lastName"
                  {...editForm.register("lastName")}
                  placeholder="Last name"
                />
                {editForm.formState.errors.lastName && (
                  <p className="text-sm text-destructive mt-1">
                    {editForm.formState.errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="edit-email">Email *</Label>
              <Input
                id="edit-email"
                type="email"
                {...editForm.register("email")}
                placeholder="user@company.com"
              />
              {editForm.formState.errors.email && (
                <p className="text-sm text-destructive mt-1">
                  {editForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="edit-username">Username *</Label>
              <Input
                id="edit-username"
                {...editForm.register("username")}
                placeholder="username"
              />
              {editForm.formState.errors.username && (
                <p className="text-sm text-destructive mt-1">
                  {editForm.formState.errors.username.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="edit-role">Role *</Label>
              <Select
                onValueChange={(value) => editForm.setValue("role", value as any)}
                value={editForm.watch("role")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              {editForm.formState.errors.role && (
                <p className="text-sm text-destructive mt-1">
                  {editForm.formState.errors.role.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-department">Department</Label>
                <Input
                  id="edit-department"
                  {...editForm.register("department")}
                  placeholder="Department"
                />
              </div>
              <div>
                <Label htmlFor="edit-position">Position</Label>
                <Input
                  id="edit-position"
                  {...editForm.register("position")}
                  placeholder="Job position"
                />
              </div>
            </div>
            
            {/* This section was wrapped in a redundant div, checking and fixing closure */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-employeeId">Employee ID</Label>
                <Input
                  id="edit-employeeId"
                  {...editForm.register("employeeId")}
                  placeholder="EMP-001"
                />
              </div>
              <div>
                <Label htmlFor="edit-phoneNumber">Phone Number</Label>
                <Input
                  id="edit-phoneNumber"
                  {...editForm.register("phoneNumber")}
                  placeholder="+63 XXX XXX XXXX"
                />
              </div>
            </div>

            {/* 🟢 LEAVE BALANCES SECTION (Updated for Balance and Limit) */}
            <h4 className="text-lg font-semibold border-b pb-1 mt-4">Leave Management</h4>
            
            <p className="text-sm text-muted-foreground">Adjust the employee's current used balance and their maximum annual entitlement.</p>
            
            {/* Row 1: Current Balances */}
            {/* <h5 className="font-medium mt-4">Current Balance (Days Remaining)</h5>
            <div className="grid grid-cols-3 gap-4">
                <div>
                    <Label htmlFor="annualLeaveBalance">Annual Leave</Label>
                    <Input
                        id="annualLeaveBalance"
                        type="number"
                        min={0}
                        {...editForm.register("annualLeaveBalance")}
                        placeholder="Current Balance"
                    />
                </div>
                <div>
                    <Label htmlFor="sickLeaveBalance">Sick Leave</Label>
                    <Input
                        id="sickLeaveBalance"
                        type="number"
                        min={0}
                        {...editForm.register("sickLeaveBalance")}
                        placeholder="Current Balance"
                    />
                </div>
                <div>
                    <Label htmlFor="serviceIncentiveLeaveBalance">Service Incentive Leave</Label>
                    <Input
                        id="serviceIncentiveLeaveBalance"
                        type="number"
                        min={0}
                        {...editForm.register("serviceIncentiveLeaveBalance")}
                        placeholder="Current Balance"
                    />
                </div>
            </div> */}

            {/* Row 2: Maximum Limits */}
            <h5 className="font-medium mt-4">Maximum Limit (Annual Entitlement)</h5>
            <div className="grid grid-cols-3 gap-4">
                <div>
                    <Label htmlFor="annualLeaveBalanceLimit">Annual Leave Limit</Label>
                    <Input
                        id="annualLeaveBalanceLimit"
                        type="number"
                        min={0}
                        {...editForm.register("annualLeaveBalanceLimit")}
                        placeholder="Max Limit"
                    />
                </div>
                <div>
                    <Label htmlFor="sickLeaveBalanceLimit">Sick Leave Limit</Label>
                    <Input
                        id="sickLeaveBalanceLimit"
                        type="number"
                        min={0}
                        {...editForm.register("sickLeaveBalanceLimit")}
                        placeholder="Max Limit"
                    />
                </div>
                <div>
                    <Label htmlFor="serviceIncentiveLeaveBalanceLimit">Service Incentive Leave Limit</Label>
                    <Input
                        id="serviceIncentiveLeaveBalanceLimit"
                        type="number"
                        min={0}
                        {...editForm.register("serviceIncentiveLeaveBalanceLimit")}
                        placeholder="Max Limit"
                    />
                </div>
            </div>

            {editForm.watch("role") === "employee" && (
              <div>
                <Label htmlFor="edit-managerId">Manager</Label>
                <Select
                  value={editForm.watch("managerId") || ""}
                  onValueChange={(value) => editForm.setValue("managerId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select manager" />
                  </SelectTrigger>
                  <SelectContent>
                    {managers.map((manager: any) => (
                        <SelectItem key={manager.id} value={manager.id}>
                          {manager.firstName} {manager.lastName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={editUserMutation.isPending}>
                {editUserMutation.isPending ? "Updating..." : "Update User"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={(open) => {
        setIsPasswordDialogOpen(open);
        if (!open) {
          passwordForm.reset();
          setSelectedUser(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Set a new password for {selectedUser?.firstName} {selectedUser?.lastName}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="newPassword">New Password *</Label>
              <Input
                id="newPassword"
                type="password"
                {...passwordForm.register("newPassword")}
                placeholder="Enter new password"
              />
              {passwordForm.formState.errors.newPassword && (
                <p className="text-sm text-destructive mt-1">
                  {passwordForm.formState.errors.newPassword.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm Password *</Label>
              <Input
                id="confirmPassword"
                type="password"
                {...passwordForm.register("confirmPassword")}
                placeholder="Confirm new password"
              />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-sm text-destructive mt-1">
                  {passwordForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPasswordDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={changePasswordMutation.isPending}>
                {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => {
        setIsDeleteDialogOpen(open);
        if (!open) {
          setSelectedUser(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Delete User Account
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the account for{" "}
              <span className="font-semibold">
                {selectedUser?.firstName} {selectedUser?.lastName}
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUserMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* 🟢 Manager Demotion Alert Dialog */}
      <AlertDialog open={isDemotionAlertOpen} onOpenChange={setIsDemotionAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Potential Manager Demotion Conflict
            </AlertDialogTitle>
            <AlertDialogDescription>
              The user <span className="font-semibold">{selectedUser?.firstName} {selectedUser?.lastName}</span> is currently assigned as the manager for one or more employees.
              <br/><br/>
              To avoid a Foreign Key error, you must ensure their direct reports are reassigned or removed before demoting this user from a Manager role.
              <br/><br/>
              **Warning:** Proceeding will likely result in an error if the backend is configured with strict foreign key constraints.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            <AlertDialogAction 
                onClick={handleConfirmedDemotion} 
                className="bg-warning text-white hover:bg-warning/80"
                disabled={editUserMutation.isPending}
            >
              Proceed Anyway (Requires backend handling)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}