import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User, Mail, Phone, MapPin, Briefcase, Calendar, Edit, Shield, HeartPulse, Home } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const profileUpdateSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phoneNumber: z.string().optional().refine((val) => {
    if (!val || val.trim() === "") return true;
    const phoneRegex = /^[\d\s\-\(\)\+]+$/;
    return phoneRegex.test(val);
  }, "Phone number can only contain numbers and basic formatting characters"),
});

const emergencyContactSchema = z.object({
  name: z.string().min(1, "Emergency contact name is required"),
  relationship: z.string().min(1, "Relationship is required"),
  phone: z.string().min(1, "Emergency contact phone is required").refine((val) => {
    const phoneRegex = /^[\d\s\-\(\)\+]+$/;
    return phoneRegex.test(val);
  }, "Phone number can only contain numbers and basic formatting characters"),
});

const addressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
});

type ProfileUpdateForm = z.infer<typeof profileUpdateSchema>;
type EmergencyContactForm = z.infer<typeof emergencyContactSchema>;
type AddressForm = z.infer<typeof addressSchema>;

export default function Profile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const profileForm = useForm<ProfileUpdateForm>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
      phoneNumber: user?.phoneNumber || "",
    },
  });

  const emergencyForm = useForm<EmergencyContactForm>({
    resolver: zodResolver(emergencyContactSchema),
    defaultValues: {
      name: (user?.emergencyContact as any)?.name || "",
      relationship: (user?.emergencyContact as any)?.relationship || "",
      phone: (user?.emergencyContact as any)?.phone || "",
    },
  });

  const addressForm = useForm<AddressForm>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      street: (user?.address as any)?.street || "",
      city: (user?.address as any)?.city || "",
      state: (user?.address as any)?.state || "",
      zipCode: (user?.address as any)?.zipCode || "",
      country: (user?.address as any)?.country || "",
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileUpdateForm) => {
      const res = await apiRequest("PATCH", "/api/profile", data);
      return await res.json();
    },
    onSuccess: () => {
      toast.success("Profile updated", { description: "Your profile has been updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast.error("Update failed", { description: error.message });
    },
  });

  const updateEmergencyContactMutation = useMutation({
    mutationFn: async (data: EmergencyContactForm) => {
      const res = await apiRequest("PATCH", "/api/profile", { emergencyContact: data });
      return await res.json();
    },
    onSuccess: () => {
      toast.success("Emergency contact updated", { description: "Your emergency contact has been updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (error: Error) => {
      toast.error("Update failed", { description: error.message });
    },
  });

  const updateAddressMutation = useMutation({
    mutationFn: async (data: AddressForm) => {
      const res = await apiRequest("PATCH", "/api/profile", { address: data });
      return await res.json();
    },
    onSuccess: () => {
      toast.success("Address updated", { description: "Your address has been updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (error: Error) => {
      toast.error("Update failed", { description: error.message });
    },
  });

  const onProfileUpdate = (data: ProfileUpdateForm) => updateProfileMutation.mutate(data);
  const onEmergencyContactUpdate = (data: EmergencyContactForm) => updateEmergencyContactMutation.mutate(data);
  const onAddressUpdate = (data: AddressForm) => updateAddressMutation.mutate(data);

  if (!user) return null;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Hero Header */}
      <div className="relative bg-slate-900 rounded-3xl p-8 overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-end gap-6">
          <Avatar className="w-24 h-24 md:w-32 md:h-32 border-4 border-white/10 shadow-xl">
            <AvatarImage src={user.profilePicture || ""} />
            <AvatarFallback className="bg-slate-800 text-white text-3xl md:text-4xl">
              {user.firstName.charAt(0)}{user.lastName.charAt(0)}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 text-center md:text-left space-y-2 pb-2">
             <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">{user.firstName} {user.lastName}</h1>
             <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-slate-400">
                <Badge variant="outline" className="border-slate-700 text-slate-300 px-3 py-1 capitalize">
                   <Briefcase className="w-3 h-3 mr-1.5" /> {user.position || "Employee"}
                </Badge>
                <Badge variant="outline" className="border-slate-700 text-slate-300 px-3 py-1 capitalize">
                   <Shield className="w-3 h-3 mr-1.5" /> {user.department || "General"}
                </Badge>
                <span className="text-sm flex items-center gap-1.5">
                   <Mail className="w-3.5 h-3.5" /> {user.email}
                </span>
             </div>
          </div>

          <Button 
            onClick={() => setIsEditing(!isEditing)} 
            variant={isEditing ? "secondary" : "default"}
            className={`rounded-full px-6 shadow-lg ${isEditing ? 'bg-white text-slate-900 hover:bg-slate-200' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
            data-testid="button-edit-profile"
          >
            <Edit className="w-4 h-4 mr-2" />
            {isEditing ? "Cancel Editing" : "Edit Profile"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="personal" className="space-y-8">
        <div className="flex justify-center">
           <TabsList className="bg-white/80 backdrop-blur-md border border-slate-200/60 p-1 rounded-full h-auto shadow-sm" data-testid="profile-tabs">
             <TabsTrigger value="personal" className="rounded-full px-6 py-2.5 data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all" data-testid="tab-personal">Personal Info</TabsTrigger>
             <TabsTrigger value="contact" className="rounded-full px-6 py-2.5 data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all" data-testid="tab-contact">Contact Details</TabsTrigger>
             <TabsTrigger value="employment" className="rounded-full px-6 py-2.5 data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all" data-testid="tab-employment">Employment</TabsTrigger>
           </TabsList>
        </div>

        <TabsContent value="personal" className="mt-0 focus-visible:outline-none">
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Main Info */}
              <Card className="lg:col-span-2 bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-sm rounded-3xl overflow-hidden">
                 <CardHeader className="border-b border-slate-100 bg-white/50">
                    <CardTitle className="flex items-center text-slate-800">
                       <User className="w-5 h-5 mr-2 text-blue-600" /> Basic Information
                    </CardTitle>
                    <CardDescription>Manage your primary identification details</CardDescription>
                 </CardHeader>
                 <CardContent className="p-6 md:p-8">
                    {isEditing ? (
                       <form onSubmit={profileForm.handleSubmit(onProfileUpdate)} className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div className="space-y-2">
                                <Label htmlFor="firstName" className="text-slate-600">First Name</Label>
                                <Input id="firstName" {...profileForm.register("firstName")} className="rounded-xl bg-white border-slate-200 focus:ring-blue-500/20" />
                                {profileForm.formState.errors.firstName && <p className="text-xs text-red-500">{profileForm.formState.errors.firstName.message}</p>}
                             </div>
                             <div className="space-y-2">
                                <Label htmlFor="lastName" className="text-slate-600">Last Name</Label>
                                <Input id="lastName" {...profileForm.register("lastName")} className="rounded-xl bg-white border-slate-200 focus:ring-blue-500/20" />
                                {profileForm.formState.errors.lastName && <p className="text-xs text-red-500">{profileForm.formState.errors.lastName.message}</p>}
                             </div>
                             <div className="space-y-2">
                                <Label htmlFor="email" className="text-slate-600">Email Address</Label>
                                <Input id="email" type="email" {...profileForm.register("email")} className="rounded-xl bg-white border-slate-200 focus:ring-blue-500/20" />
                                {profileForm.formState.errors.email && <p className="text-xs text-red-500">{profileForm.formState.errors.email.message}</p>}
                             </div>
                             <div className="space-y-2">
                                <Label htmlFor="phoneNumber" className="text-slate-600">Phone Number</Label>
                                <Input id="phoneNumber" {...profileForm.register("phoneNumber")} className="rounded-xl bg-white border-slate-200 focus:ring-blue-500/20" />
                             </div>
                          </div>
                          <div className="flex justify-end pt-4">
                             <Button type="submit" disabled={updateProfileMutation.isPending} className="rounded-full bg-slate-900 hover:bg-slate-800 px-8">
                                {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                             </Button>
                          </div>
                       </form>
                    ) : (
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-1">
                             <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Full Name</p>
                             <p className="text-lg font-semibold text-slate-900">{user.firstName} {user.lastName}</p>
                          </div>
                          <div className="space-y-1">
                             <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Email</p>
                             <p className="text-lg font-semibold text-slate-900">{user.email}</p>
                          </div>
                          <div className="space-y-1">
                             <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Phone</p>
                             <p className="text-lg font-semibold text-slate-900">{user.phoneNumber || "Not provided"}</p>
                          </div>
                          <div className="space-y-1">
                             <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Employee ID</p>
                             <p className="text-lg font-semibold text-slate-900 font-mono">{user.employeeId || "N/A"}</p>
                          </div>
                       </div>
                    )}
                 </CardContent>
              </Card>
              
              {/* Right Column: Quick Stats */}
              <div className="space-y-6">
                 <Card className="bg-blue-50/50 backdrop-blur-xl border-blue-100/60 shadow-sm rounded-3xl">
                    <CardContent className="p-6 flex items-center gap-4">
                       <div className="h-12 w-12 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600">
                          <Calendar className="w-6 h-6" />
                       </div>
                       <div>
                          <p className="text-sm font-medium text-blue-600/80 uppercase tracking-wider">Joined On</p>
                          <p className="text-xl font-bold text-blue-900">
                             {user.hireDate ? new Date(user.hireDate).toLocaleDateString() : "N/A"}
                          </p>
                       </div>
                    </CardContent>
                 </Card>
                 <Card className="bg-emerald-50/50 backdrop-blur-xl border-emerald-100/60 shadow-sm rounded-3xl">
                    <CardContent className="p-6 flex items-center gap-4">
                       <div className="h-12 w-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                          <Shield className="w-6 h-6" />
                       </div>
                       <div>
                          <p className="text-sm font-medium text-emerald-600/80 uppercase tracking-wider">System Role</p>
                          <p className="text-xl font-bold text-emerald-900 capitalize">{user.role.replace('_', ' ')}</p>
                       </div>
                    </CardContent>
                 </Card>
              </div>
           </div>
        </TabsContent>

        <TabsContent value="contact" className="mt-0 focus-visible:outline-none">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Emergency Contact */}
              <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-sm rounded-3xl overflow-hidden h-full">
                 <CardHeader className="border-b border-slate-100 bg-white/50">
                    <CardTitle className="flex items-center text-slate-800">
                       <HeartPulse className="w-5 h-5 mr-2 text-rose-500" /> Emergency Contact
                    </CardTitle>
                    <CardDescription>Person to contact in case of emergency</CardDescription>
                 </CardHeader>
                 <CardContent className="p-6 md:p-8">
                    <form onSubmit={emergencyForm.handleSubmit(onEmergencyContactUpdate)} className="space-y-5">
                       <div className="space-y-2">
                          <Label htmlFor="emergencyName" className="text-slate-600">Contact Name</Label>
                          <Input id="emergencyName" {...emergencyForm.register("name")} className="rounded-xl bg-white border-slate-200" placeholder="Full Name" />
                          {emergencyForm.formState.errors.name && <p className="text-xs text-red-500">{emergencyForm.formState.errors.name.message}</p>}
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                             <Label htmlFor="relationship" className="text-slate-600">Relationship</Label>
                             <Input id="relationship" {...emergencyForm.register("relationship")} className="rounded-xl bg-white border-slate-200" placeholder="e.g. Spouse" />
                             {emergencyForm.formState.errors.relationship && <p className="text-xs text-red-500">{emergencyForm.formState.errors.relationship.message}</p>}
                          </div>
                          <div className="space-y-2">
                             <Label htmlFor="emergencyPhone" className="text-slate-600">Phone</Label>
                             <Input id="emergencyPhone" {...emergencyForm.register("phone")} className="rounded-xl bg-white border-slate-200" placeholder="+63..." />
                             {emergencyForm.formState.errors.phone && <p className="text-xs text-red-500">{emergencyForm.formState.errors.phone.message}</p>}
                          </div>
                       </div>
                       <div className="flex justify-end pt-2">
                          <Button type="submit" disabled={updateEmergencyContactMutation.isPending} className="rounded-full bg-slate-900 hover:bg-slate-800">
                             {updateEmergencyContactMutation.isPending ? "Saving..." : "Update Contact"}
                          </Button>
                       </div>
                    </form>
                 </CardContent>
              </Card>

              {/* Address */}
              <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-sm rounded-3xl overflow-hidden h-full">
                 <CardHeader className="border-b border-slate-100 bg-white/50">
                    <CardTitle className="flex items-center text-slate-800">
                       <Home className="w-5 h-5 mr-2 text-amber-500" /> Residential Address
                    </CardTitle>
                    <CardDescription>Where you currently live</CardDescription>
                 </CardHeader>
                 <CardContent className="p-6 md:p-8">
                    <form onSubmit={addressForm.handleSubmit(onAddressUpdate)} className="space-y-5">
                       <div className="space-y-2">
                          <Label htmlFor="street" className="text-slate-600">Street Address</Label>
                          <Textarea id="street" {...addressForm.register("street")} className="rounded-xl bg-white border-slate-200 resize-none" rows={2} placeholder="House No., Street Name, Brgy." />
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                             <Label htmlFor="city" className="text-slate-600">City</Label>
                             <Input id="city" {...addressForm.register("city")} className="rounded-xl bg-white border-slate-200" />
                          </div>
                          <div className="space-y-2">
                             <Label htmlFor="state" className="text-slate-600">Province/State</Label>
                             <Input id="state" {...addressForm.register("state")} className="rounded-xl bg-white border-slate-200" />
                          </div>
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                             <Label htmlFor="zipCode" className="text-slate-600">ZIP Code</Label>
                             <Input id="zipCode" {...addressForm.register("zipCode")} className="rounded-xl bg-white border-slate-200" />
                          </div>
                          <div className="space-y-2">
                             <Label htmlFor="country" className="text-slate-600">Country</Label>
                             <Input id="country" {...addressForm.register("country")} className="rounded-xl bg-white border-slate-200" />
                          </div>
                       </div>
                       <div className="flex justify-end pt-2">
                          <Button type="submit" disabled={updateAddressMutation.isPending} className="rounded-full bg-slate-900 hover:bg-slate-800">
                             {updateAddressMutation.isPending ? "Saving..." : "Update Address"}
                          </Button>
                       </div>
                    </form>
                 </CardContent>
              </Card>
           </div>
        </TabsContent>

        <TabsContent value="employment" className="mt-0 focus-visible:outline-none">
           <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-sm rounded-3xl overflow-hidden">
              <CardHeader className="border-b border-slate-100 bg-white/50">
                 <CardTitle className="flex items-center text-slate-800">
                    <Briefcase className="w-5 h-5 mr-2 text-indigo-600" /> Employment Details
                 </CardTitle>
                 <CardDescription>Read-only view of your employment status</CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-6">
                       <div className="flex items-start space-x-4">
                          <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600"><Briefcase className="w-6 h-6" /></div>
                          <div>
                             <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Position</p>
                             <p className="text-xl font-bold text-slate-900 mt-1">{user.position || "Not assigned"}</p>
                          </div>
                       </div>
                       <div className="flex items-start space-x-4">
                          <div className="p-3 bg-violet-50 rounded-2xl text-violet-600"><Shield className="w-6 h-6" /></div>
                          <div>
                             <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Department</p>
                             <p className="text-xl font-bold text-slate-900 mt-1">{user.department || "Not assigned"}</p>
                          </div>
                       </div>
                    </div>
                    <div className="space-y-6">
                       <div className="flex items-start space-x-4">
                          <div className="p-3 bg-amber-50 rounded-2xl text-amber-600"><Calendar className="w-6 h-6" /></div>
                          <div>
                             <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Date Hired</p>
                             <p className="text-xl font-bold text-slate-900 mt-1">
                                {user.hireDate ? new Date(user.hireDate).toLocaleDateString(undefined, { dateStyle: 'long' }) : "Not recorded"}
                             </p>
                          </div>
                       </div>
                       <div className="flex items-start space-x-4">
                          <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600"><User className="w-6 h-6" /></div>
                          <div>
                             <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Role Access</p>
                             <Badge className="mt-1 bg-slate-900 hover:bg-slate-800 text-white uppercase text-xs tracking-widest">{user.role.replace('_', ' ')}</Badge>
                          </div>
                       </div>
                    </div>
                 </div>
              </CardContent>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}