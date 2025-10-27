import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAnnouncementSchema } from "@shared/schema";
import { z } from "zod";
import { Megaphone, Plus, Edit, Eye, EyeOff, Trash2, Users, Calendar, Filter } from "lucide-react";
import type { Announcement } from "@shared/schema";

const announcementFormSchema = insertAnnouncementSchema.extend({
  targetDepartments: z.array(z.string()).optional(),
}).omit({ authorId: true });

type AnnouncementForm = z.infer<typeof announcementFormSchema>;

export default function Announcements() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const canManageAnnouncements = user?.role === 'manager' || user?.role === 'admin';

  const { data: announcements, isLoading } = useQuery({
    queryKey: ["/api/announcements"],
  });

  const form = useForm<AnnouncementForm>({
    resolver: zodResolver(announcementFormSchema),
    defaultValues: {
      title: "",
      content: "",
      type: "general",
      targetDepartments: [],
      isActive: true,
    },
  });

  const createAnnouncementMutation = useMutation({
    mutationFn: async (data: AnnouncementForm) => {
      const res = await apiRequest("POST", "/api/announcements", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Announcement created",
        description: "Your announcement has been published successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
      setIsDialogOpen(false);
      form.reset();
      setEditingAnnouncement(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Creation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateAnnouncementMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Announcement> }) => {
      const res = await apiRequest("PATCH", `/api/announcements/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Announcement updated",
        description: "The announcement has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!canManageAnnouncements) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="text-center py-12">
              <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Access Restricted</h3>
              <p className="text-muted-foreground">
                You need manager or HR privileges to manage announcements.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const onSubmit = (data: AnnouncementForm) => {
    if (editingAnnouncement) {
      updateAnnouncementMutation.mutate({
        id: editingAnnouncement.id,
        data,
      });
    } else {
      createAnnouncementMutation.mutate(data);
    }
  };

  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    form.reset({
      title: announcement.title,
      content: announcement.content,
      type: announcement.type || "general",
      targetDepartments: announcement.targetDepartments as string[] || [],
      isActive: announcement.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleToggleActive = (announcement: Announcement) => {
    updateAnnouncementMutation.mutate({
      id: announcement.id,
      data: { isActive: !announcement.isActive },
    });
  };

  const getTypeBadge = (type: string) => {
    const colors = {
      general: "bg-primary text-primary-foreground",
      urgent: "bg-destructive text-destructive-foreground",
      holiday: "bg-success text-white",
      policy: "bg-warning text-white",
    };

    return (
      <Badge className={colors[type as keyof typeof colors] || colors.general}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </Badge>
    );
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (date: string | Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getAnnouncementIcon = (type: string) => {
    switch (type) {
      case "urgent":
        return "🚨";
      case "holiday":
        return "🎉";
      case "policy":
        return "📋";
      default:
        return "📢";
    }
  };

  const filteredAnnouncements = announcements?.filter((announcement: Announcement) => {
    const typeMatch = filterType === "all" || announcement.type === filterType;
    const statusMatch = filterStatus === "all" || 
      (filterStatus === "active" && announcement.isActive) ||
      (filterStatus === "inactive" && !announcement.isActive);
    
    return typeMatch && statusMatch;
  }) || [];

  const getAnnouncementStats = () => {
    if (!announcements) return { total: 0, active: 0, urgent: 0, thisWeek: 0 };
    
    const total = announcements.length;
    const active = announcements.filter((a: Announcement) => a.isActive).length;
    const urgent = announcements.filter((a: Announcement) => a.type === "urgent" && a.isActive).length;
    
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const thisWeek = announcements.filter((a: Announcement) => 
      new Date(a.createdAt!) > oneWeekAgo
    ).length;
    
    return { total, active, urgent, thisWeek };
  };

  const stats = getAnnouncementStats();

  const departments = ["Engineering", "Marketing", "Sales", "HR", "Finance", "Operations"];

  const resetForm = () => {
    setEditingAnnouncement(null);
    form.reset({
      title: "",
      content: "",
      type: "general",
      targetDepartments: [],
      isActive: true,
    });
  };

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="page-title">Announcements</h1>
            <p className="text-muted-foreground">
              Create and manage company-wide communications
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-announcement">
                <Plus className="w-4 h-4 mr-2" />
                Create Announcement
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingAnnouncement ? "Edit Announcement" : "Create New Announcement"}
                </DialogTitle>
                <DialogDescription>
                  {editingAnnouncement 
                    ? "Update your announcement details" 
                    : "Share important information with your team"
                  }
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    data-testid="input-title"
                    {...form.register("title")}
                    placeholder="Enter announcement title"
                  />
                  {form.formState.errors.title && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.title.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="content">Content</Label>
                  <Textarea
                    id="content"
                    data-testid="input-content"
                    {...form.register("content")}
                    placeholder="Enter announcement content"
                    rows={4}
                  />
                  {form.formState.errors.content && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.content.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="type">Type</Label>
                    <Select
                      onValueChange={(value) => form.setValue("type", value)}
                      defaultValue={form.getValues("type")}
                    >
                      <SelectTrigger data-testid="select-type">
                        <SelectValue placeholder="Select announcement type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="holiday">Holiday</SelectItem>
                        <SelectItem value="policy">Policy Update</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center space-x-2 pt-7">
                    <Switch
                      id="isActive"
                      checked={form.watch("isActive")}
                      onCheckedChange={(checked) => form.setValue("isActive", checked)}
                      data-testid="switch-active"
                    />
                    <Label htmlFor="isActive">Active</Label>
                  </div>
                </div>

                <div>
                  <Label>Target Departments (Optional)</Label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {departments.map((dept) => (
                      <div key={dept} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`dept-${dept}`}
                          data-testid={`checkbox-${dept.toLowerCase()}`}
                          onChange={(e) => {
                            const current = form.getValues("targetDepartments") || [];
                            if (e.target.checked) {
                              form.setValue("targetDepartments", [...current, dept]);
                            } else {
                              form.setValue("targetDepartments", current.filter(d => d !== dept));
                            }
                          }}
                          checked={form.watch("targetDepartments")?.includes(dept)}
                        />
                        <Label htmlFor={`dept-${dept}`} className="text-sm">
                          {dept}
                        </Label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty to target all departments
                  </p>
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createAnnouncementMutation.isPending || updateAnnouncementMutation.isPending}
                    data-testid="button-submit"
                  >
                    {(createAnnouncementMutation.isPending || updateAnnouncementMutation.isPending) 
                      ? "Saving..." 
                      : editingAnnouncement 
                        ? "Update Announcement" 
                        : "Create Announcement"
                    }
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold" data-testid="total-announcements">
                    {stats.total}
                  </p>
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Megaphone className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold" data-testid="active-announcements">
                    {stats.active}
                  </p>
                </div>
                <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center">
                  <Eye className="w-6 h-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Urgent</p>
                  <p className="text-2xl font-bold" data-testid="urgent-announcements">
                    {stats.urgent}
                  </p>
                </div>
                <div className="w-12 h-12 bg-destructive/10 rounded-lg flex items-center justify-center">
                  <Megaphone className="w-6 h-6 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">This Week</p>
                  <p className="text-2xl font-bold" data-testid="weekly-announcements">
                    {stats.thisWeek}
                  </p>
                </div>
                <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  <Megaphone className="w-5 h-5 mr-2" />
                  All Announcements
                </CardTitle>
                <CardDescription>
                  Manage your organization's communications
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-32" data-testid="filter-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="holiday">Holiday</SelectItem>
                    <SelectItem value="policy">Policy</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-32" data-testid="filter-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8" data-testid="loading-announcements">
                <p className="text-muted-foreground">Loading announcements...</p>
              </div>
            ) : filteredAnnouncements.length > 0 ? (
              <div className="space-y-4">
                {filteredAnnouncements.map((announcement: Announcement) => (
                  <Card key={announcement.id} className="hover:shadow-md transition-shadow" data-testid={`announcement-${announcement.id}`}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-4 flex-1">
                          <div className="text-2xl" data-testid={`announcement-icon-${announcement.id}`}>
                            {getAnnouncementIcon(announcement.type || "general")}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-3 mb-2">
                              <h3 className="font-semibold text-lg" data-testid={`announcement-title-${announcement.id}`}>
                                {announcement.title}
                              </h3>
                              {getTypeBadge(announcement.type || "general")}
                              {announcement.isActive ? (
                                <Badge className="bg-success text-white">Active</Badge>
                              ) : (
                                <Badge variant="secondary">Inactive</Badge>
                              )}
                            </div>
                            <p className="text-muted-foreground mb-3" data-testid={`announcement-content-${announcement.id}`}>
                              {announcement.content}
                            </p>
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                              <div className="flex items-center space-x-1">
                                <Calendar className="w-3 h-3" />
                                <span data-testid={`announcement-date-${announcement.id}`}>
                                  {formatDate(announcement.createdAt!)} at {formatTime(announcement.createdAt!)}
                                </span>
                              </div>
                              {announcement.targetDepartments && (announcement.targetDepartments as string[]).length > 0 && (
                                <div className="flex items-center space-x-1">
                                  <Users className="w-3 h-3" />
                                  <span data-testid={`announcement-departments-${announcement.id}`}>
                                    {(announcement.targetDepartments as string[]).join(", ")}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleActive(announcement)}
                            disabled={updateAnnouncementMutation.isPending}
                            data-testid={`button-toggle-${announcement.id}`}
                          >
                            {announcement.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(announcement)}
                            data-testid={`button-edit-${announcement.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12" data-testid="no-announcements">
                <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  {announcements?.length === 0 
                    ? "No announcements yet" 
                    : "No announcements match your filters"
                  }
                </h3>
                <p className="text-muted-foreground mb-4">
                  {announcements?.length === 0 
                    ? "Create your first announcement to get started" 
                    : "Try adjusting your filters to see more results"
                  }
                </p>
                {announcements?.length === 0 && (
                  <Button onClick={() => setIsDialogOpen(true)} data-testid="button-create-first">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Announcement
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
