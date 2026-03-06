import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePermission } from "@/hooks/use-permission";
import { Permission } from "@/lib/permissions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Search, Shield, History, Download, ChevronLeft, ChevronRight, Loader2, Filter, Eye, Database, Code } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { User as UserType } from "@shared/schema";

const styles = {
  pageWrapper: "p-6 md:p-8 max-w-7xl mx-auto space-y-8",
  headerRow: "flex flex-col md:flex-row md:items-center justify-between gap-4",
  title: "text-3xl font-bold tracking-tight text-slate-900",
  subtitle: "text-slate-500 mt-1 text-sm",
  
  toolbarCard: "flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm",
  searchWrapper: "relative w-full lg:w-96",
  searchInput: "pl-9 h-10 w-full bg-slate-50 border-slate-200 focus:bg-white transition-all rounded-xl",
  
  tableCard: "bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden",
  tableHead: "bg-slate-50/80 border-b border-slate-100",
  tableRow: "hover:bg-slate-50/50 transition-colors border-slate-100 group cursor-pointer",
  
  avatarBox: "h-8 w-8 rounded-full border border-slate-200",
  avatarFallback: "bg-slate-100 text-slate-600 text-xs font-bold",
  paginationBar: "flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50",
};

const safeFormatDate = (dateVal: any, formatString: string) => {
  if (!dateVal) return "N/A";
  try {
    const dateObj = new Date(Number(dateVal) || dateVal);
    if (isNaN(dateObj.getTime())) return "Invalid Date";
    return format(dateObj, formatString);
  } catch (error) {
    return "Invalid Date";
  }
};

export default function AdminLogs() {
  const { hasPermission } = usePermission();
  const canViewLogs = hasPermission(Permission.VIEW_AUDIT_LOGS);

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: activities, isLoading: logsLoading } = useQuery({
    queryKey: ["/api/activities/all", { limit: 1000 }],
    queryFn: async () => {
      const res = await fetch("/api/activities/all?limit=1000");
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    },
    enabled: canViewLogs,
  });

  const { data: users, isLoading: usersLoading } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
    enabled: canViewLogs,
  });

  const userMap = useMemo(() => {
    if (!users) return new Map();
    return users.reduce((map, u) => { map.set(u.id, u); return map; }, new Map());
  }, [users]);

  const filteredLogs = useMemo(() => {
    if (!activities) return [];
    let filtered = [...activities];

    if (typeFilter !== "all") {
      filtered = filtered.filter((log: any) => log.entityType === typeFilter || log.type.includes(typeFilter));
    }

    if (searchTerm) {
      const lowerQuery = searchTerm.toLowerCase();
      filtered = filtered.filter((log: any) => {
        const u = userMap.get(log.userId);
        const userName = u ? `${u.firstName} ${u.lastName}`.toLowerCase() : "";
        const details = log.details ? String(log.details).toLowerCase() : "";
        const type = log.type.toLowerCase();
        
        return userName.includes(lowerQuery) || details.includes(lowerQuery) || type.includes(lowerQuery);
      });
    }

    return filtered;
  }, [activities, searchTerm, typeFilter, userMap]);

  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(start, start + itemsPerPage);
  }, [filteredLogs, currentPage]);

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);

  const getActionBadge = (type: string) => {
    const formatted = type.replace(/_/g, ' ');
    if (type.includes('in') || type.includes('create') || type.includes('approve') || type.includes('generate')) {
      return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 capitalize">{formatted}</Badge>;
    }
    if (type.includes('out') || type.includes('end') || type.includes('update')) {
      return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 capitalize">{formatted}</Badge>;
    }
    if (type.includes('delete') || type.includes('reject')) {
      return <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 capitalize">{formatted}</Badge>;
    }
    return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 capitalize">{formatted}</Badge>;
  };

  const getInitials = (first?: string, last?: string) => `${first?.charAt(0) || ''}${last?.charAt(0) || ''}`.toUpperCase() || '??';

  const viewDetails = (log: any) => {
    setSelectedLog(log);
    setIsDialogOpen(true);
  };

  if (!canViewLogs) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <Card className="w-full max-w-md bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-lg rounded-3xl">
          <CardContent className="py-12 text-center space-y-4">
            <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-rose-500">
                <Shield className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Access Restricted</h2>
            <p className="text-slate-500">You require Administrator privileges to view system audit logs.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>System Audit Logs</h1>
          <p className={styles.subtitle}>Immutable record of all critical system events and user activities.</p>
        </div>
        <Button variant="outline" className="bg-white rounded-xl shadow-sm border-slate-200" onClick={() => window.print()}>
          <Download className="w-4 h-4 mr-2" /> Export Logs
        </Button>
      </div>

      <div className={styles.toolbarCard}>
        <div className={styles.searchWrapper}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Search logs by user, action, or details..." 
            className={styles.searchInput}
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <Filter className="w-4 h-4 text-slate-400" /> Filter:
          </div>
          <Select value={typeFilter} onValueChange={(val) => { setTypeFilter(val); setCurrentPage(1); }}>
            <SelectTrigger className="w-[180px] h-10 rounded-xl bg-slate-50 border-slate-200">
              <SelectValue placeholder="All Activities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Activities</SelectItem>
              <SelectItem value="user">User Profiles</SelectItem>
              <SelectItem value="schedule">Schedules</SelectItem>
              <SelectItem value="report">Incident Reports</SelectItem>
              <SelectItem value="leave">Leave Requests</SelectItem>
              <SelectItem value="payslip">Payslips</SelectItem>
              <SelectItem value="clock">Time Clock</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className={styles.tableCard}>
        <div className="overflow-x-auto">
          <Table className="min-w-[800px]">
            <TableHeader className={styles.tableHead}>
              <TableRow>
                <TableHead className="w-[160px] font-semibold text-slate-600">Timestamp</TableHead>
                <TableHead className="w-[220px] font-semibold text-slate-600">Initiated By</TableHead>
                <TableHead className="w-[160px] font-semibold text-slate-600">Action</TableHead>
                <TableHead className="font-semibold text-slate-600">Event Details</TableHead>
                <TableHead className="w-[80px] text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logsLoading || usersLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading audit trail...
                  </TableCell>
                </TableRow>
              ) : paginatedLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-slate-400">
                    <History className="w-8 h-8 mx-auto mb-2 opacity-20" /> No logs found matching your criteria.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedLogs.map((log: any) => {
                  const u = userMap.get(log.userId);
                  return (
                    <TableRow key={log.id} className={styles.tableRow} onClick={() => viewDetails(log)}>
                      <TableCell className="font-mono text-xs text-slate-500 whitespace-nowrap">
                        {safeFormatDate(log.timestamp || log.createdAt, "MMM dd, yyyy")}<br />
                        {safeFormatDate(log.timestamp || log.createdAt, "hh:mm:ss a")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className={styles.avatarBox}>
                            <AvatarImage src={u?.profilePicture || ""} />
                            <AvatarFallback className={styles.avatarFallback}>{getInitials(u?.firstName, u?.lastName)}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm text-slate-900">{u ? `${u.firstName} ${u.lastName}` : "System"}</span>
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider">{u?.role?.replace('_', ' ') || "Automated"}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getActionBadge(log.type)}</TableCell>
                      <TableCell className="text-sm text-slate-600 max-w-[250px] truncate">
                        <span className="font-semibold text-slate-800 mr-2 capitalize">{log.entityType}:</span>
                        {log.details || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {filteredLogs.length > 0 && (
          <div className={styles.paginationBar}>
            <p className="text-xs text-slate-500 font-medium">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredLogs.length)} of {filteredLogs.length} logs
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs font-medium px-3 text-slate-700">Page {currentPage} of {totalPages || 1}</span>
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Detail Inspection Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                    <Database className="w-5 h-5 text-blue-600" /> Activity Inspector
                </DialogTitle>
                <DialogDescription>Raw system event details and metadata payload.</DialogDescription>
            </DialogHeader>

            {selectedLog && (
                <div className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Timestamp</p>
                            <p className="text-sm font-mono font-medium text-slate-800">{safeFormatDate(selectedLog.timestamp || selectedLog.createdAt, "PPpp")}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Action Type</p>
                            <div>{getActionBadge(selectedLog.type)}</div>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Entity Modified</p>
                            <Badge variant="secondary" className="uppercase bg-white">{selectedLog.entityType || "System"}</Badge>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Record ID</p>
                            <p className="text-xs font-mono text-slate-600 bg-slate-200 px-2 py-1 rounded inline-block truncate max-w-full">
                                {selectedLog.entityId || "N/A"}
                            </p>
                        </div>
                    </div>

                    <div>
                        <p className="text-sm font-semibold text-slate-800 mb-2">Description</p>
                        <div className="p-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-600">
                            {selectedLog.details || "No description provided."}
                        </div>
                    </div>

                    <div>
                        <p className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
                            <Code className="w-4 h-4 text-slate-500" /> JSON Metadata Payload
                        </p>
                        <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto border border-slate-800">
                            <pre className="text-xs font-mono text-emerald-400">
                                {selectedLog.metadata 
                                    ? JSON.stringify(selectedLog.metadata, null) 
                                    : <span className="text-slate-500">{"// No additional metadata attached to this event"}</span>
                                }
                            </pre>
                        </div>
                    </div>
                </div>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}