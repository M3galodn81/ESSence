import { useState, useEffect, useDeferredValue } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  UserPlus,
  Users,
  Shield,
  Edit,
  Trash2,
  Key,
  Briefcase,
  AlertTriangle,
  UserCheck,
  Search,
  MapPin,
  Phone
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

// --- Helpers ---
const formatDateForInput = (date?: number | string | Date | null) => {
  if (!date) return "";
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

// --- Schemas ---

const addressSchema = z.object({
  street: z.string().min(1, "Street is required"),
  city: z.string().min(1, "City is required"),
  province: z.string().min(1, "Province is required"),
  zipCode: z.string().min(1, "Zip Code is required"),
  country: z.string().optional().default("Philippines"),
});

const emergencyContactSchema = z.object({
  name: z.string().min(1, "Contact name is required"),
  relation: z.string().min(1, "Relation is required"),
  phone: z.string().min(1, "Contact phone is required"),
});

const createUserSchema = z.object({
  // Identity
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Last name is required"),
  birthDate: z.string().min(1, "Birth date is required"),
  gender: z.enum(["Male", "Female", "Prefer not to say"], { required_error: "Gender is required" }),
  civilStatus: z.enum(["Single", "Married", "Widowed", "Separated", "Divorced"], { required_error: "Civil Status is required" }),
  nationality: z.string().min(1, "Nationality is required").default("Filipino"),
  
  // Account
  username: z.string(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email("Invalid email address"),
  role: z.enum(["employee", "manager", "payroll_officer", "admin"]),
  
  // Employment
  employeeId: z.string(),
  department: z.string().optional(),
  position: z.string().optional(),
  employmentStatus: z.enum(["regular", "probationary", "contractual"]).default("regular"),
  hireDate: z.string().min(1, "Hire date is required"),
  managerId: z.string().optional(),
  
  // Contact
  phoneNumber: z.string().min(1, "Phone number is required"),
  address: addressSchema,
  emergencyContact: emergencyContactSchema,
});

const editUserSchema = createUserSchema.partial().extend({
  annualLeaveBalanceLimit: z.coerce.number().optional(),
  sickLeaveBalanceLimit: z.coerce.number().optional(),
  serviceIncentiveLeaveBalanceLimit: z.coerce.number().optional(),
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

// --- Helper Components (Defined OUTSIDE to fix focus issues) ---

const ErrorMsg = ({ error }: { error?: { message?: string } }) => {
  if (!error?.message) return null;
  return <p className="text-xs text-rose-500 mt-1.5 font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {error.message}</p>;
};

const PersonalInfoSection = ({ form }: { form: UseFormReturn<any> }) => (
    <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-slate-500" /> Personal Information
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
                <Label>First Name *</Label>
                <Input {...form.register("firstName")} className="rounded-xl mt-1.5" />
                <ErrorMsg error={form.formState.errors.firstName} />
            </div>
            <div>
                <Label>Middle Name</Label>
                <Input {...form.register("middleName")} className="rounded-xl mt-1.5" />
            </div>
            <div>
                <Label>Last Name *</Label>
                <Input {...form.register("lastName")} className="rounded-xl mt-1.5" />
                <ErrorMsg error={form.formState.errors.lastName} />
            </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
                <Label>Birth Date *</Label>
                <Input type="date" {...form.register("birthDate")} className="rounded-xl mt-1.5" />
                <ErrorMsg error={form.formState.errors.birthDate} />
            </div>
            <div>
                <Label>Gender *</Label>
                <Select onValueChange={(val) => form.setValue("gender", val)} defaultValue={form.getValues("gender")}>
                    <SelectTrigger className="rounded-xl mt-1.5"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                    </SelectContent>
                </Select>
                <ErrorMsg error={form.formState.errors.gender} />
            </div>
            <div>
                <Label>Civil Status *</Label>
                <Select onValueChange={(val) => form.setValue("civilStatus", val)} defaultValue={form.getValues("civilStatus")}>
                    <SelectTrigger className="rounded-xl mt-1.5"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Single">Single</SelectItem>
                        <SelectItem value="Married">Married</SelectItem>
                        <SelectItem value="Widowed">Widowed</SelectItem>
                        <SelectItem value="Separated">Separated</SelectItem>
                        <SelectItem value="Divorced">Divorced</SelectItem>
                    </SelectContent>
                </Select>
                <ErrorMsg error={form.formState.errors.civilStatus} />
            </div>
            <div>
                <Label>Nationality *</Label>
                <Input {...form.register("nationality")} className="rounded-xl mt-1.5" />
                <ErrorMsg error={form.formState.errors.nationality} />
            </div>
        </div>
    </div>
);

const EmploymentSection = ({ form, isEdit = false, managers }: { form: UseFormReturn<any>, isEdit?: boolean, managers: any[] }) => (
    <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-slate-500" /> Employment & Account
        </h3>
        
        {/* IDs and Auto-gens */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div>
                <Label className="text-slate-500">Hire Date *</Label>
                <Input type="date" {...form.register("hireDate")} className="rounded-xl mt-1.5 bg-white" />
                <ErrorMsg error={form.formState.errors.hireDate} />
                {!isEdit && <p className="text-[10px] text-slate-400 mt-1">Used for ID generation</p>}
            </div>
             <div>
                <Label className="text-slate-500">{isEdit ? "Employee ID" : "Auto-Generated ID"}</Label>
                <Input {...form.register("employeeId")} readOnly={!isEdit} className={`rounded-xl mt-1.5 ${!isEdit ? "bg-slate-100 font-mono text-slate-500" : "bg-white"}`} />
            </div>
            <div>
                <Label className="text-slate-500">{isEdit ? "Username" : "Auto-Generated Username"}</Label>
                <Input {...form.register("username")} readOnly={!isEdit} className={`rounded-xl mt-1.5 ${!isEdit ? "bg-slate-100 font-mono text-slate-500" : "bg-white"}`} />
            </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
                <Label>Department</Label>
                <Input {...form.register("department")} className="rounded-xl mt-1.5" />
            </div>
            <div>
                <Label>Position</Label>
                <Input {...form.register("position")} className="rounded-xl mt-1.5" />
            </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div>
                <Label>Employment Status</Label>
                <Select onValueChange={(val) => form.setValue("employmentStatus", val)} defaultValue={form.getValues("employmentStatus")}>
                    <SelectTrigger className="rounded-xl mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="regular">Regular</SelectItem>
                        <SelectItem value="probationary">Probationary</SelectItem>
                        <SelectItem value="contractual">Contractual</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div>
                <Label>Role</Label>
                <Select onValueChange={(val) => form.setValue("role", val)} defaultValue={form.getValues("role")}>
                    <SelectTrigger className="rounded-xl mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                         <SelectItem value="admin">Admin</SelectItem>
                         <SelectItem value="manager">Manager</SelectItem>
                         <SelectItem value="payroll_officer">Payroll Officer</SelectItem>
                         <SelectItem value="employee">Employee</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
        
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div>
                <Label>Email *</Label>
                <Input type="email" {...form.register("email")} className="rounded-xl mt-1.5" />
                <ErrorMsg error={form.formState.errors.email} />
             </div>
             {/* Only show Password on Create, not Edit (handled via dialog) */}
             {!isEdit && (
                 <div>
                    <Label>Password *</Label>
                    <Input type="password" {...form.register("password")} className="rounded-xl mt-1.5" />
                    <ErrorMsg error={form.formState.errors.password} />
                 </div>
             )}
        </div>

         {/* Manager Logic */}
         {(form.watch("role") === "employee") && (
            <div>
                <Label>Manager (Optional)</Label>
                <Select onValueChange={(value) => form.setValue("managerId", value)} defaultValue={form.getValues("managerId")}>
                <SelectTrigger className="rounded-xl mt-1.5"><SelectValue placeholder="Select manager" /></SelectTrigger>
                <SelectContent className="rounded-xl">
                    <SelectItem value="none">No Manager</SelectItem>
                    {managers.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.firstName} {m.lastName}</SelectItem>)}
                </SelectContent>
                </Select>
            </div>
        )}

        {isEdit && (
            <div className="space-y-3 pt-4 border-t border-slate-100">
                <h4 className="text-sm font-semibold text-slate-900">Leave Limits (Annual)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div><Label className="text-xs text-slate-500">Vacation Leave</Label><Input type="number" {...form.register("annualLeaveBalanceLimit")} className="rounded-xl mt-1" /></div>
                    <div><Label className="text-xs text-slate-500">Sick Leave</Label><Input type="number" {...form.register("sickLeaveBalanceLimit")} className="rounded-xl mt-1" /></div>
                    <div><Label className="text-xs text-slate-500">Service Incentive</Label><Input type="number" {...form.register("serviceIncentiveLeaveBalanceLimit")} className="rounded-xl mt-1" /></div>
                </div>
            </div>
        )}
    </div>
);

const ContactSection = ({ form }: { form: UseFormReturn<any> }) => (
    <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-500" /> Address & Contact
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div>
                <Label>Mobile Number *</Label>
                <Input {...form.register("phoneNumber")} className="rounded-xl mt-1.5" />
                <ErrorMsg error={form.formState.errors.phoneNumber} />
             </div>
             <div>
                <Label>Street Address *</Label>
                <Input {...form.register("address.street")} className="rounded-xl mt-1.5" />
                <ErrorMsg error={form.formState.errors.address?.street} />
             </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
                <Label>City *</Label>
                <Input {...form.register("address.city")} className="rounded-xl mt-1.5" />
                <ErrorMsg error={form.formState.errors.address?.city} />
            </div>
            <div>
                <Label>Province *</Label>
                <Input {...form.register("address.province")} className="rounded-xl mt-1.5" />
                <ErrorMsg error={form.formState.errors.address?.province} />
            </div>
            <div>
                <Label>Zip Code *</Label>
                <Input {...form.register("address.zipCode")} className="rounded-xl mt-1.5" />
                <ErrorMsg error={form.formState.errors.address?.zipCode} />
            </div>
        </div>
        
        <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-100">
            <h4 className="text-xs font-bold uppercase text-rose-700 mb-3 flex items-center gap-2">
                <Phone className="w-3 h-3" /> Emergency Contact
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                     <Label className="text-rose-900">Name *</Label>
                     <Input {...form.register("emergencyContact.name")} className="bg-white rounded-xl mt-1.5" />
                     <ErrorMsg error={form.formState.errors.emergencyContact?.name} />
                </div>
                <div>
                     <Label className="text-rose-900">Relation *</Label>
                     <Input {...form.register("emergencyContact.relation")} className="bg-white rounded-xl mt-1.5" />
                     <ErrorMsg error={form.formState.errors.emergencyContact?.relation} />
                </div>
                <div>
                     <Label className="text-rose-900">Phone *</Label>
                     <Input {...form.register("emergencyContact.phone")} className="bg-white rounded-xl mt-1.5" />
                     <ErrorMsg error={form.formState.errors.emergencyContact?.phone} />
                </div>
            </div>
        </div>
    </div>
);

// --- Main Component ---

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
      role: "employee",
      nationality: "Filipino",
      employmentStatus: "regular",
      address: { country: "Philippines" }
    },
  });

  const editForm = useForm<EditUserForm>({
    resolver: zodResolver(editUserSchema),
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

  // --- Auto-Generate Username Logic ---
  const watchName = createForm.watch(["firstName", "middleName", "lastName"]);
  
  useEffect(() => {
    if (isCreateDialogOpen && watchName[0] && watchName[2]) {
      const first = watchName[0].trim().toLowerCase().replace(/\s+/g, '');
      const middle = watchName[1]?.trim().toLowerCase().replace(/\s+/g, '');
      const last = watchName[2].trim().toLowerCase().replace(/\s+/g, '');

      if (!first || !last) return;

      const baseUsername = `${first}.${last}`;
      const isTaken = users.some((u: any) => u.username === baseUsername);
      
      let finalUsername = baseUsername;
      
      if (isTaken) {
         if (middle) {
             finalUsername = `${first}.${middle}.${last}`;
             if (users.some((u: any) => u.username === finalUsername)) {
                 finalUsername = `${finalUsername}1`;
             }
         } else {
             finalUsername = `${baseUsername}1`;
         }
      }

      createForm.setValue("username", finalUsername);
    }
  }, [watchName[0], watchName[1], watchName[2], isCreateDialogOpen, users]);

  // --- Auto-Generate Employee ID Logic ---
  const watchHireDate = createForm.watch("hireDate");

  useEffect(() => {
    if (isCreateDialogOpen && watchHireDate) {
      const date = new Date(watchHireDate);
      if (isNaN(date.getTime())) return;

      const year = date.getFullYear().toString();
      const existingIdsInYear = users
        .map((u: any) => u.employeeId)
        .filter((id: string) => id && id.startsWith(year));

      let maxSeq = 0;
      existingIdsInYear.forEach((id: string) => {
        const seqPart = id.substring(4); 
        const num = parseInt(seqPart, 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      });

      const nextSeq = (maxSeq + 1).toString().padStart(3, "0");
      createForm.setValue("employeeId", `${year}${nextSeq}`);
    }
  }, [watchHireDate, isCreateDialogOpen, users]);


  // --- Mutations ---

  const createUserMutation = useMutation({
    mutationFn: async (data: CreateUserForm) => {
      const payload = {
        ...data,
        birthDate: new Date(data.birthDate).getTime(),
        hireDate: new Date(data.hireDate).getTime(),
        managerId: data.managerId === "none" ? null : data.managerId,
      };

      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
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
       const payload: any = { ...data };

       if (data.birthDate) payload.birthDate = new Date(data.birthDate).getTime();
       if (data.hireDate) payload.hireDate = new Date(data.hireDate).getTime();
       
       ['annualLeaveBalanceLimit', 'sickLeaveBalanceLimit', 'serviceIncentiveLeaveBalanceLimit'].forEach(key => {
            // @ts-ignore
            if (payload[key] === "") payload[key] = null;
       });
       
       if (data.role !== 'employee') payload.managerId = null;

      const response = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
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
      ...userData,
      birthDate: formatDateForInput(userData.birthDate),
      hireDate: formatDateForInput(userData.hireDate),
      
      address: userData.address || { street: "", city: "", province: "", zipCode: "", country: "Philippines" },
      emergencyContact: userData.emergencyContact || { name: "", relation: "", phone: "" },
      
      managerId: userData.managerId || "none",
      annualLeaveBalanceLimit: userData.annualLeaveBalanceLimit || "",
      sickLeaveBalanceLimit: userData.sickLeaveBalanceLimit || "",
      serviceIncentiveLeaveBalanceLimit: userData.serviceIncentiveLeaveBalanceLimit || "",
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
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">User Management</h1>
          <p className="text-slate-500 mt-1 text-sm">Create and manage user accounts and permissions</p>
        </div>
      
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
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
        
        {/* Create Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) createForm.reset();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20 rounded-full px-6">
              <UserPlus className="w-4 h-4 mr-2" /> <span className="hidden sm:inline">Create User</span><span className="sm:hidden">Create</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-xl">
            <DialogHeader className="px-6 py-4 border-b shrink-0">
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>Add a new user to the system.</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-6 py-4">
                <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-6">
                    <PersonalInfoSection form={createForm} />
                    <Separator />
                    <EmploymentSection form={createForm} managers={managers} />
                    <Separator />
                    <ContactSection form={createForm} />
                </form>
            </div>
            <DialogFooter className="px-6 py-4 border-t bg-slate-50 shrink-0">
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="rounded-full">Cancel</Button>
              <Button onClick={createForm.handleSubmit(onCreateSubmit)} disabled={createUserMutation.isPending} className="rounded-full bg-slate-900">
                {createUserMutation.isPending ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Bento Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <BentoCard title="Total Users" value={stats.total} icon={Users} variant="default" testIdPrefix="stat-total" />
        <BentoCard title="Employees" value={stats.employees} icon={UserCheck} variant="emerald" testIdPrefix="stat-employees" />
        <BentoCard title="Managers" value={stats.managers} icon={Briefcase} variant="rose" testIdPrefix="stat-managers" />
        <BentoCard title="Admins" value={stats.admins} icon={Shield} variant="amber" testIdPrefix="stat-admins" />
      </div>

      {/* Glass User Grid */}
      {usersLoading ? (
        <div className="text-center py-12 text-slate-400">Loading users...</div>
      ) : filteredUsers.length === 0 ? (
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {filteredUsers.map((u: any) => (
            <Card key={u.id} className="bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-sm hover:shadow-md transition-all rounded-2xl overflow-hidden group">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                      <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center text-lg font-bold text-slate-600 border border-slate-200 shrink-0">
                        {u.firstName.charAt(0)}{u.lastName.charAt(0)}
                      </div>
                      <div className="overflow-hidden">
                        <h3 className="font-bold text-slate-900 truncate">{u.firstName} {u.lastName}</h3>
                        <p className="text-xs text-slate-500 truncate">{u.email}</p>
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
                  <div className="flex items-center gap-2 pt-4 border-t border-slate-100/50 opacity-100 sm:opacity-60 sm:group-hover:opacity-100 transition-opacity">
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
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-xl">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Modify user details and permissions.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-6">
                 <PersonalInfoSection form={editForm} />
                 <Separator />
                 <EmploymentSection form={editForm} isEdit={true} managers={managers} />
                 <Separator />
                 <ContactSection form={editForm} />
              </form>
          </div>
          <DialogFooter className="px-6 py-4 border-t bg-slate-50 shrink-0">
               <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} className="rounded-full">Cancel</Button>
               <Button onClick={editForm.handleSubmit(onEditSubmit)} disabled={editUserMutation.isPending} className="rounded-full bg-slate-900">Save Changes</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={(open) => { setIsPasswordDialogOpen(open); if (!open) passwordForm.reset(); }}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader><DialogTitle>Change Password</DialogTitle></DialogHeader>
          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
             <div>
                <Label>New Password</Label>
                <Input type="password" {...passwordForm.register("newPassword")} className="rounded-xl" />
                <ErrorMsg error={passwordForm.formState.errors.newPassword} />
             </div>
             <div>
                <Label>Confirm Password</Label>
                <Input type="password" {...passwordForm.register("confirmPassword")} className="rounded-xl" />
                <ErrorMsg error={passwordForm.formState.errors.confirmPassword} />
             </div>
             <DialogFooter>
               <Button type="button" variant="outline" onClick={() => setIsPasswordDialogOpen(false)} className="rounded-full">Cancel</Button>
               <Button type="submit" disabled={changePasswordMutation.isPending} className="rounded-full bg-slate-900">Update Password</Button>
             </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => { setIsDeleteDialogOpen(open); if (!open) setSelectedUser(null); }}>
        <AlertDialogContent className="rounded-2xl max-w-md">
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
        <AlertDialogContent className="rounded-2xl max-w-md">
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