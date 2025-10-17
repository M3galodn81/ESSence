import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User, Mail, Phone, MapPin, Briefcase, Calendar, Edit } from "lucide-react";

const profileUpdateSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phoneNumber: z.string().optional(),
});

const emergencyContactSchema = z.object({
  name: z.string().min(1, "Emergency contact name is required"),
  relationship: z.string().min(1, "Relationship is required"),
  phone: z.string().min(1, "Emergency contact phone is required"),
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
  const { toast } = useToast();
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
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateEmergencyContactMutation = useMutation({
    mutationFn: async (data: EmergencyContactForm) => {
      const res = await apiRequest("PATCH", "/api/profile", {
        emergencyContact: data,
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Emergency contact updated",
        description: "Your emergency contact has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateAddressMutation = useMutation({
    mutationFn: async (data: AddressForm) => {
      const res = await apiRequest("PATCH", "/api/profile", {
        address: data,
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Address updated",
        description: "Your address has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onProfileUpdate = (data: ProfileUpdateForm) => {
    updateProfileMutation.mutate(data);
  };

  const onEmergencyContactUpdate = (data: EmergencyContactForm) => {
    updateEmergencyContactMutation.mutate(data);
  };

  const onAddressUpdate = (data: AddressForm) => {
    updateAddressMutation.mutate(data);
  };

  if (!user) return null;

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="page-title">My Profile</h1>
            <p className="text-muted-foreground">Manage your personal information</p>
          </div>
          <Button
            onClick={() => setIsEditing(!isEditing)}
            variant={isEditing ? "outline" : "default"}
            data-testid="button-edit-profile"
          >
            <Edit className="w-4 h-4 mr-2" />
            {isEditing ? "Cancel" : "Edit Profile"}
          </Button>
        </div>

        <Tabs defaultValue="personal" className="space-y-6">
          <TabsList data-testid="profile-tabs">
            <TabsTrigger value="personal" data-testid="tab-personal">Personal Info</TabsTrigger>
            <TabsTrigger value="contact" data-testid="tab-contact">Contact Details</TabsTrigger>
            <TabsTrigger value="employment" data-testid="tab-employment">Employment</TabsTrigger>
          </TabsList>

          <TabsContent value="personal">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <User className="w-5 h-5 mr-2" />
                    Basic Information
                  </CardTitle>
                  <CardDescription>Your personal details</CardDescription>
                </CardHeader>
                <CardContent>
                  {isEditing ? (
                    <form onSubmit={profileForm.handleSubmit(onProfileUpdate)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="firstName">First Name</Label>
                          <Input
                            id="firstName"
                            data-testid="input-first-name"
                            {...profileForm.register("firstName")}
                          />
                          {profileForm.formState.errors.firstName && (
                            <p className="text-sm text-destructive mt-1">
                              {profileForm.formState.errors.firstName.message}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="lastName">Last Name</Label>
                          <Input
                            id="lastName"
                            data-testid="input-last-name"
                            {...profileForm.register("lastName")}
                          />
                          {profileForm.formState.errors.lastName && (
                            <p className="text-sm text-destructive mt-1">
                              {profileForm.formState.errors.lastName.message}
                            </p>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          data-testid="input-email"
                          {...profileForm.register("email")}
                        />
                        {profileForm.formState.errors.email && (
                          <p className="text-sm text-destructive mt-1">
                            {profileForm.formState.errors.email.message}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="phoneNumber">Phone Number</Label>
                        <Input
                          id="phoneNumber"
                          data-testid="input-phone"
                          {...profileForm.register("phoneNumber")}
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={updateProfileMutation.isPending}
                        data-testid="button-save-profile"
                      >
                        {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                    </form>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium" data-testid="text-full-name">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">Full Name</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium" data-testid="text-email">{user.email}</p>
                          <p className="text-sm text-muted-foreground">Email Address</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium" data-testid="text-phone">
                            {user.phoneNumber || "Not provided"}
                          </p>
                          <p className="text-sm text-muted-foreground">Phone Number</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Emergency Contact */}
              <Card>
                <CardHeader>
                  <CardTitle>Emergency Contact</CardTitle>
                  <CardDescription>Contact person in case of emergency</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={emergencyForm.handleSubmit(onEmergencyContactUpdate)} className="space-y-4">
                    <div>
                      <Label htmlFor="emergencyName">Contact Name</Label>
                      <Input
                        id="emergencyName"
                        data-testid="input-emergency-name"
                        {...emergencyForm.register("name")}
                        placeholder="Emergency contact name"
                      />
                      {emergencyForm.formState.errors.name && (
                        <p className="text-sm text-destructive mt-1">
                          {emergencyForm.formState.errors.name.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="relationship">Relationship</Label>
                      <Input
                        id="relationship"
                        data-testid="input-relationship"
                        {...emergencyForm.register("relationship")}
                        placeholder="e.g., Spouse, Parent, Sibling"
                      />
                      {emergencyForm.formState.errors.relationship && (
                        <p className="text-sm text-destructive mt-1">
                          {emergencyForm.formState.errors.relationship.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="emergencyPhone">Phone Number</Label>
                      <Input
                        id="emergencyPhone"
                        data-testid="input-emergency-phone"
                        {...emergencyForm.register("phone")}
                        placeholder="Emergency contact phone"
                      />
                      {emergencyForm.formState.errors.phone && (
                        <p className="text-sm text-destructive mt-1">
                          {emergencyForm.formState.errors.phone.message}
                        </p>
                      )}
                    </div>
                    <Button
                      type="submit"
                      disabled={updateEmergencyContactMutation.isPending}
                      data-testid="button-save-emergency"
                    >
                      {updateEmergencyContactMutation.isPending ? "Saving..." : "Update Emergency Contact"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="contact">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MapPin className="w-5 h-5 mr-2" />
                  Address Information
                </CardTitle>
                <CardDescription>Your residential address</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={addressForm.handleSubmit(onAddressUpdate)} className="space-y-4">
                  <div>
                    <Label htmlFor="street">Street Address</Label>
                    <Textarea
                      id="street"
                      data-testid="input-street"
                      {...addressForm.register("street")}
                      placeholder="Enter your street address"
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        data-testid="input-city"
                        {...addressForm.register("city")}
                        placeholder="City"
                      />
                    </div>
                    <div>
                      <Label htmlFor="state">State/Province</Label>
                      <Input
                        id="state"
                        data-testid="input-state"
                        {...addressForm.register("state")}
                        placeholder="State or Province"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="zipCode">ZIP/Postal Code</Label>
                      <Input
                        id="zipCode"
                        data-testid="input-zip"
                        {...addressForm.register("zipCode")}
                        placeholder="ZIP Code"
                      />
                    </div>
                    <div>
                      <Label htmlFor="country">Country</Label>
                      <Input
                        id="country"
                        data-testid="input-country"
                        {...addressForm.register("country")}
                        placeholder="Country"
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={updateAddressMutation.isPending}
                    data-testid="button-save-address"
                  >
                    {updateAddressMutation.isPending ? "Saving..." : "Update Address"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="employment">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Briefcase className="w-5 h-5 mr-2" />
                  Employment Information
                </CardTitle>
                <CardDescription>Your job details and work information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <Briefcase className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium" data-testid="text-position">{user.position || "Not specified"}</p>
                        <p className="text-sm text-muted-foreground">Position</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium" data-testid="text-department">{user.department || "Not specified"}</p>
                        <p className="text-sm text-muted-foreground">Department</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium" data-testid="text-hire-date">
                          {user.hireDate ? new Date(user.hireDate).toLocaleDateString() : "Not specified"}
                        </p>
                        <p className="text-sm text-muted-foreground">Hire Date</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-4 h-4 bg-primary rounded-full" />
                      <div>
                        <p className="font-medium capitalize" data-testid="text-role">{user.role}</p>
                        <p className="text-sm text-muted-foreground">Role</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-4 h-4 bg-muted-foreground rounded-full" />
                      <div>
                        <p className="font-medium" data-testid="text-employee-id">{user.employeeId || "Not assigned"}</p>
                        <p className="text-sm text-muted-foreground">Employee ID</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className={`w-4 h-4 rounded-full ${user.isActive ? 'bg-success' : 'bg-destructive'}`} />
                      <div>
                        <p className="font-medium" data-testid="text-status">
                          {user.isActive ? "Active" : "Inactive"}
                        </p>
                        <p className="text-sm text-muted-foreground">Employment Status</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
