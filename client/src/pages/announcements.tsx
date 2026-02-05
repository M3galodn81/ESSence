import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAnnouncementSchema } from "@shared/schema";
import { z } from "zod";
import { Megaphone, Plus, Filter, Bell, AlertCircle, Clock, Eye, CheckCircle2, UserCheck, Loader2 } from "lucide-react";
import type { Announcement, User } from "@shared/schema";
import { canManageAnnouncements } from "@/utils/permissions";
import { toast } from "sonner";
import { format } from "date-fns";

// Refactored Components
import { BentoCard } from "@/components/custom/bento-card";
import { AnnouncementFeedItem } from "@/components/custom/announcement-feed-card";

// --- VIEW DETAILS & MARK READ DIALOG ---
function ViewAnnouncementDialog({ 
  announcement, 
  isOpen, 
  onClose,
  currentUser,
  canManage 
}: { 
  announcement: Announcement | null, 
  isOpen: boolean, 
  onClose: () => void,
  currentUser: User | null,
  canManage: boolean
}) {
  const queryClient = useQueryClient();

  const { data: readers, isLoading: isLoadingReaders } = useQuery({
    queryKey: [`/api/announcements/${announcement?.id}/reads`],
    enabled: !!announcement && isOpen && canManage, 
  });

  const { data: myReadIds } = useQuery({
    queryKey: ["/api/announcements/my-reads"],
    enabled: !!currentUser,
  });

  const isReadByMe = myReadIds?.includes(announcement?.id?.toString() || "");

  const markReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/announcements/${announcement?.id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/announcements/${announcement?.id}/reads`] });
      queryClient.invalidateQueries({ queryKey: ["/api/announcements/my-reads"] });
      toast.success("Announcement marked as read");
    }
  });

  if (!announcement) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize 
              ${announcement.type === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
              {announcement.type}
            </span>
            <span className="text-xs text-slate-400">
              {announcement.createdAt && format(new Date(announcement.createdAt), "MMM d, yyyy h:mm a")}
            </span>
          </div>
          <DialogTitle className="text-2xl font-bold text-slate-900">{announcement.title}</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto pr-2 mt-4 space-y-6">
          <div className="bg-slate-50/50 p-6 rounded-xl border border-slate-100 text-slate-700 whitespace-pre-wrap leading-relaxed">
            {announcement.content}
          </div>

          {canManage && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-slate-900">
                <UserCheck className="w-4 h-4" /> 
                Read Receipts ({readers?.length || 0})
              </h4>
              <ScrollArea className="h-[150px] w-full rounded-lg border bg-white p-0">
                {isLoadingReaders ? (
                  <div className="flex items-center justify-center h-full text-xs text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading...
                  </div>
                ) : readers?.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-0 divide-y sm:divide-y-0">
                    {readers.map((r: any) => (
                      <div key={r.userId} className="flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors">
                        <Avatar className="h-8 w-8 border border-slate-200">
                          <AvatarFallback className="text-[10px] bg-slate-100 text-slate-600 font-medium">
                            {r.user.firstName?.[0]}{r.user.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col overflow-hidden">
                          <span className="text-xs font-semibold text-slate-700 truncate">{r.user.firstName} {r.user.lastName}</span>
                          <span className="text-[10px] text-slate-400 truncate">
                            {format(new Date(r.readAt), "MMM d, h:mm a")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <Eye className="w-5 h-5 mb-1 opacity-20" />
                    <p className="text-xs">No views yet</p>
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4 pt-4 border-t flex sm:align-right items-center gap-4">
          {/* <p className="text-xs text-slate-400 hidden sm:block">
            {announcement.targetDepartments && announcement.targetDepartments.length > 0 
              ? `Target: ${announcement.targetDepartments.join(", ")}` 
              : "Target: All Company"}
          </p> */}
          <div className="flex gap-3 w-full sm:w-auto justify-end">
            <Button variant="outline" onClick={onClose} className="rounded-full">Close</Button>
            
            {/* TODO: Fix Mark as Week*/}
            {isReadByMe ? (
              <Button 
                disabled 
                variant="secondary"
                className="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full opacity-100 cursor-default"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" /> 
                Acknowledged
              </Button>
            ) : (
              <Button 
                onClick={() => markReadMutation.mutate()} 
                disabled={markReadMutation.isPending}
                className="bg-slate-900 hover:bg-slate-800 text-white rounded-full min-w-[140px]"
              >
                {markReadMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-2" /> Mark as Read
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- MAIN PAGE COMPONENT ---

const announcementFormSchema = insertAnnouncementSchema.extend({
  targetDepartments: z.array(z.string()).optional(),
}).omit({ authorId: true });

type AnnouncementForm = z.infer<typeof announcementFormSchema>;

export default function Announcements() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [viewingAnnouncement, setViewingAnnouncement] = useState<Announcement | null>(null);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("active");

  const canManage = canManageAnnouncements(user);

  const { data: announcements, isLoading } = useQuery({
    queryKey: ["/api/announcements"],
  });

  const { data: myReadIds } = useQuery({
    queryKey: ["/api/announcements/my-reads"],
    enabled: !!user,
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
      toast.success("Announcement created");
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
      setIsCreateDialogOpen(false);
      form.reset();
      setEditingAnnouncement(null);
    },
    onError: (error: Error) => {
      toast.error("Creation failed",{ description: error.message });
    },
  });

  const updateAnnouncementMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Announcement> }) => {
      const res = await fetch(`/api/announcements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return await res.json();
    },
    onSuccess: () => {
      toast.success("Announcement updated");
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
    },
    onError: (error: Error) => {
      toast.error("Update failed",{ description: error.message });
    },
  });

  const onSubmit = (data: AnnouncementForm) => {
    if (editingAnnouncement) {
      updateAnnouncementMutation.mutate({ id: editingAnnouncement.id, data });
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
    setIsCreateDialogOpen(true);
  };

  // Logic to prevent the View dialog from opening when clicking buttons
  const handleView = (announcement: Announcement, e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // If we clicked a button, SVG inside a button, or switch, don't open view
    if (target.closest('button') || target.closest('[role="switch"]')) {
      return;
    }
    setViewingAnnouncement(announcement);
  };

  const handleToggleActive = (announcement: Announcement) => {
    updateAnnouncementMutation.mutate({ id: announcement.id, data: { isActive: !announcement.isActive } });
  };

  const filteredAnnouncements = announcements?.filter((announcement: Announcement) => {
    const typeMatch = filterType === "all" || announcement.type === filterType;
    const statusMatch = (filterStatus === "active" && announcement.isActive) || 
      (filterStatus === "inactive" && !announcement.isActive) || 
      filterStatus === "all";
    return typeMatch && statusMatch;
  }) || [];

  const getAnnouncementStats = () => {
    if (!announcements) return { total: 0, active: 0, urgent: 0, thisWeek: 0 };
    const total = announcements.length;
    const active = announcements.filter((a: Announcement) => a.isActive).length;
    const urgent = announcements.filter((a: Announcement) => a.type === "urgent" && a.isActive).length;
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const thisWeek = announcements.filter((a: Announcement) => new Date(a.createdAt!) > oneWeekAgo).length;
    return { total, active, urgent, thisWeek };
  };

  const stats = getAnnouncementStats();

  const resetForm = () => {
    setEditingAnnouncement(null);
    form.reset({ title: "", content: "", type: "general", targetDepartments: [], isActive: true });
  };

  return (
    <div className="p-6 space-y-8">
      {/* View Announcement Dialog */}
      <ViewAnnouncementDialog 
        isOpen={!!viewingAnnouncement} 
        onClose={() => setViewingAnnouncement(null)} 
        announcement={viewingAnnouncement}
        currentUser={user}
        canManage={canManage}
      />

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Announcements</h1>
          <p className="text-slate-500 mt-1 text-sm">Manage company-wide communications and updates</p>
        </div>
        {canManage && (
        <Dialog open={isCreateDialogOpen} onOpenChange={(open) => { setIsCreateDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20 rounded-full px-6">
              <Plus className="w-4 h-4 mr-2" /> New Announcement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl">{editingAnnouncement ? "Edit Announcement" : "Create New Announcement"}</DialogTitle>
              <DialogDescription>{editingAnnouncement ? "Update your announcement details below" : "Share important information with your team"}</DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 mt-4">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-slate-600">Title</Label>
                <Input id="title" {...form.register("title")} placeholder="e.g., Annual Company Retreat" className="rounded-xl border-slate-200" />
                {form.formState.errors.title && <p className="text-sm text-red-500">{form.formState.errors.title.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="content" className="text-slate-600">Content</Label>
                <Textarea id="content" {...form.register("content")} placeholder="Write your announcement here..." rows={5} className="rounded-xl border-slate-200 resize-none" />
                {form.formState.errors.content && <p className="text-sm text-red-500">{form.formState.errors.content.message}</p>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="type" className="text-slate-600">Type</Label>
                  <Select onValueChange={(value) => form.setValue("type", value)} defaultValue={form.getValues("type")}>
                    <SelectTrigger className="rounded-xl border-slate-200"><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="holiday">Holiday</SelectItem>
                      <SelectItem value="policy">Policy Update</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-3 p-4 bg-slate-50 rounded-xl border border-slate-100 mt-auto">
                  <Switch id="isActive" checked={form.watch("isActive")} onCheckedChange={(checked) => form.setValue("isActive", checked)} />
                  <div className="space-y-0.5">
                    <Label htmlFor="isActive" className="text-base">Active Status</Label>
                    <p className="text-xs text-slate-500">Visible to employees immediately</p>
                  </div>
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="rounded-full border-slate-200 hover:bg-slate-50">Cancel</Button>
                <Button type="submit" disabled={createAnnouncementMutation.isPending || updateAnnouncementMutation.isPending} className="rounded-full bg-slate-900 hover:bg-slate-800">
                  {(createAnnouncementMutation.isPending || updateAnnouncementMutation.isPending) ? "Saving..." : editingAnnouncement ? "Update Announcement" : "Create Announcement"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {/* Bento Grid Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <BentoCard title="Total Announcements" value={stats.total} icon={Bell} variant="default" testIdPrefix="total-announcements" />
        <BentoCard title="Active" value={stats.active} icon={Eye} variant="emerald" testIdPrefix="active-announcements" />
        <BentoCard title="Urgent" value={stats.urgent} icon={AlertCircle} variant="rose" testIdPrefix="urgent-announcements" />
        <BentoCard title="This Week" value={stats.thisWeek} icon={Clock} variant="amber" testIdPrefix="weekly-announcements" />
      </div>

      {/* Main Content Area */}
      <Card className="glass-card">
        <CardHeader className="px-0 pt-0 pb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200/60 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-blue-50 rounded-xl flex items-center justify-center border border-blue-100">
                 <Megaphone className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-slate-800">Feed</CardTitle>
                <CardDescription className="text-xs">All company updates</CardDescription>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex items-center px-3 py-2 bg-slate-50 rounded-lg border border-slate-200/60">
                <Filter className="w-4 h-4 text-slate-400 mr-2" />
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[110px] h-8 border-none bg-transparent shadow-none focus:ring-0 text-xs font-medium">
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
                <div className="w-px h-4 bg-slate-200 mx-2" />
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[100px] h-8 border-none bg-transparent shadow-none focus:ring-0 text-xs font-medium">
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
          </div>
        </CardHeader>
        
        <CardContent className="px-0">
          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading announcements...</p>
            </div>
          ) : filteredAnnouncements.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {filteredAnnouncements.map((announcement: Announcement) => {
                // Inside filteredAnnouncements.map
                const isRead = myReadIds?.some(id => String(id) === String(announcement.id));
                
                return (
                  <div 
                    key={announcement.id} 
                    onClick={(e) => handleView(announcement, e)} 
                    // REMOVED zoom hover effect (scale) here
                    className="relative group cursor-pointer"
                  >
                    {/* RED DOT INDICATOR - Positioned inside to prevent clipping */}
                    {!isRead && (
                      <span className="absolute top-3 right-3 z-50 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white"></span>
                      </span>
                    )}

                    <AnnouncementFeedItem 
                      announcement={announcement} 
                      canManage={canManage} 
                      // REMOVED e.stopPropagation() calls to fix TypeError
                      onEdit={() => handleEdit(announcement)} 
                      onToggleActive={() => handleToggleActive(announcement)} 
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20 bg-white/50 backdrop-blur-sm rounded-3xl border border-dashed border-slate-200">
              <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                 <Megaphone className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">No announcements found</h3>
              <p className="text-slate-500 max-w-xs mx-auto mb-6">
                {announcements?.length === 0 
                  ? "Get started by creating your first company announcement." 
                  : "Try adjusting your filters to see more results."
                }
              </p>
              {canManage && announcements?.length === 0 && (
                 <Button onClick={() => setIsCreateDialogOpen(true)} className="rounded-full">
                    <Plus className="w-4 h-4 mr-2" /> Create First Announcement
                 </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}