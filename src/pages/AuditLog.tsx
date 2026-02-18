import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, Eye, Search, Filter } from "lucide-react";
import { format } from "date-fns";
import { th, enUS } from "date-fns/locale";

interface AuditLogEntry {
  log_id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_data: any;
  after_data: any;
  created_at: string;
}

interface UserProfile {
  user_id: string;
  full_name: string | null;
}

export default function AuditLog() {
  const { language } = useLanguage();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Filters
  const [filterAction, setFilterAction] = useState<string>("");
  const [filterEntityType, setFilterEntityType] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: logsData }, { data: profilesData }] = await Promise.all([
        supabase
          .from("audit_log")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.from("app_user_profile").select("user_id, full_name"),
      ]);

      setLogs(logsData || []);
      setProfiles(profilesData || []);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const getActorName = (userId: string | null) => {
    if (!userId) return language === "th" ? "ระบบ" : "System";
    const profile = profiles.find((p) => p.user_id === userId);
    return profile?.full_name || userId.slice(0, 8) + "...";
  };

  const getActionBadgeVariant = (action: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (action.toUpperCase()) {
      case "CREATE":
      case "INSERT":
        return "default";
      case "UPDATE":
        return "secondary";
      case "DELETE":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, { th: string; en: string }> = {
      CREATE: { th: "สร้าง", en: "Create" },
      INSERT: { th: "เพิ่ม", en: "Insert" },
      UPDATE: { th: "แก้ไข", en: "Update" },
      DELETE: { th: "ลบ", en: "Delete" },
      SUBMIT: { th: "ส่ง", en: "Submit" },
      APPROVE: { th: "อนุมัติ", en: "Approve" },
      REJECT: { th: "ปฏิเสธ", en: "Reject" },
    };
    return labels[action.toUpperCase()]?.[language] || action;
  };

  const getEntityTypeLabel = (entityType: string) => {
    const labels: Record<string, { th: string; en: string }> = {
      company: { th: "บริษัท", en: "Company" },
      site: { th: "สถานที่", en: "Site" },
      reporting_period: { th: "รอบระยะเวลา", en: "Reporting Period" },
      esg_dimension: { th: "มิติ ESG", en: "ESG Dimension" },
      esg_theme: { th: "หัวข้อ ESG", en: "ESG Theme" },
      esg_metric: { th: "ตัวชี้วัด", en: "ESG Metric" },
      metric_value: { th: "ค่าตัวชี้วัด", en: "Metric Value" },
      user: { th: "ผู้ใช้", en: "User" },
      user_roles: { th: "สิทธิ์ผู้ใช้", en: "User Roles" },
    };
    return labels[entityType]?.[language] || entityType;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, "dd MMM yyyy HH:mm:ss", {
      locale: language === "th" ? th : enUS,
    });
  };

  const uniqueActions = [...new Set(logs.map((l) => l.action))];
  const uniqueEntityTypes = [...new Set(logs.map((l) => l.entity_type))];

  const filteredLogs = logs.filter((log) => {
    if (filterAction && log.action !== filterAction) return false;
    if (filterEntityType && log.entity_type !== filterEntityType) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const actorName = getActorName(log.actor_user_id).toLowerCase();
      const entityId = (log.entity_id || "").toLowerCase();
      if (!actorName.includes(search) && !entityId.includes(search)) return false;
    }
    return true;
  });

  const handleViewDetail = (log: AuditLogEntry) => {
    setSelectedLog(log);
    setDetailOpen(true);
  };

  const renderJsonData = (data: any, title: string) => {
    if (!data) return null;
    return (
      <div className="space-y-2">
        <h4 className="font-medium text-sm">{title}</h4>
        <ScrollArea className="h-48 rounded-md border bg-muted/50 p-3">
          <pre className="text-xs whitespace-pre-wrap break-all">
            {JSON.stringify(data, null, 2)}
          </pre>
        </ScrollArea>
      </div>
    );
  };

  return (
    <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <History className="h-8 w-8 text-primary" />
            {language === "th" ? "บันทึกการใช้งาน" : "Audit Log"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {language === "th"
              ? "ประวัติการดำเนินการทั้งหมดในระบบ"
              : "Complete history of system activities"}
          </p>
        </div>

        {/* Filters */}
        <Card className="glass-card-solid overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-foreground">
              <Filter className="h-4 w-4 text-primary" />
              {language === "th" ? "ตัวกรอง" : "Filters"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  {language === "th" ? "ค้นหา" : "Search"}
                </Label>
                <Input
                  placeholder={
                    language === "th"
                      ? "ค้นหาผู้ใช้หรือ Entity ID..."
                      : "Search user or Entity ID..."
                  }
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{language === "th" ? "การดำเนินการ" : "Action"}</Label>
                <Select
                  value={filterAction || "__all__"}
                  onValueChange={(v) => setFilterAction(v === "__all__" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={language === "th" ? "ทั้งหมด" : "All"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">
                      {language === "th" ? "ทั้งหมด" : "All"}
                    </SelectItem>
                    {uniqueActions.map((action) => (
                      <SelectItem key={action} value={action}>
                        {getActionLabel(action)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{language === "th" ? "ประเภทข้อมูล" : "Entity Type"}</Label>
                <Select
                  value={filterEntityType || "__all__"}
                  onValueChange={(v) => setFilterEntityType(v === "__all__" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={language === "th" ? "ทั้งหมด" : "All"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">
                      {language === "th" ? "ทั้งหมด" : "All"}
                    </SelectItem>
                    {uniqueEntityTypes.map((entityType) => (
                      <SelectItem key={entityType} value={entityType}>
                        {getEntityTypeLabel(entityType)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card className="glass-card-solid overflow-hidden">
          <CardHeader>
            <CardTitle className="text-foreground">
              {language === "th" ? "รายการบันทึก" : "Log Entries"}
              <Badge variant="secondary" className="ml-2">
                {filteredLogs.length} {language === "th" ? "รายการ" : "records"}
              </Badge>
            </CardTitle>
            <CardDescription>
              {language === "th"
                ? "แสดง 500 รายการล่าสุด"
                : "Showing latest 500 entries"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                {language === "th" ? "กำลังโหลด..." : "Loading..."}
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {language === "th" ? "ไม่พบข้อมูล" : "No data found"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        {language === "th" ? "วันที่/เวลา" : "Date/Time"}
                      </TableHead>
                      <TableHead>
                        {language === "th" ? "ผู้ดำเนินการ" : "Actor"}
                      </TableHead>
                      <TableHead>
                        {language === "th" ? "การดำเนินการ" : "Action"}
                      </TableHead>
                      <TableHead>
                        {language === "th" ? "ประเภทข้อมูล" : "Entity Type"}
                      </TableHead>
                      <TableHead>
                        {language === "th" ? "Entity ID" : "Entity ID"}
                      </TableHead>
                      <TableHead className="text-right">
                        {language === "th" ? "รายละเอียด" : "Details"}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.log_id}>
                        <TableCell className="font-mono text-sm">
                          {formatDate(log.created_at)}
                        </TableCell>
                        <TableCell>{getActorName(log.actor_user_id)}</TableCell>
                        <TableCell>
                          <Badge variant={getActionBadgeVariant(log.action)}>
                            {getActionLabel(log.action)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {getEntityTypeLabel(log.entity_type)}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground max-w-32 truncate">
                          {log.entity_id || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewDetail(log)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="glass-card-solid max-w-2xl max-h-[80vh] overflow-y-auto rounded-3xl border-white/30">
            <DialogHeader>
              <DialogTitle>
                {language === "th" ? "รายละเอียดบันทึก" : "Log Details"}
              </DialogTitle>
              <DialogDescription>
                {selectedLog && formatDate(selectedLog.created_at)}
              </DialogDescription>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">
                      {language === "th" ? "ผู้ดำเนินการ" : "Actor"}
                    </Label>
                    <p className="font-medium">
                      {getActorName(selectedLog.actor_user_id)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">
                      {language === "th" ? "การดำเนินการ" : "Action"}
                    </Label>
                    <p>
                      <Badge variant={getActionBadgeVariant(selectedLog.action)}>
                        {getActionLabel(selectedLog.action)}
                      </Badge>
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">
                      {language === "th" ? "ประเภทข้อมูล" : "Entity Type"}
                    </Label>
                    <p className="font-medium">
                      {getEntityTypeLabel(selectedLog.entity_type)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Entity ID</Label>
                    <p className="font-mono text-sm">
                      {selectedLog.entity_id || "-"}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4">
                  {renderJsonData(
                    selectedLog.before_data,
                    language === "th" ? "ข้อมูลก่อนเปลี่ยนแปลง" : "Before Data"
                  )}
                  {renderJsonData(
                    selectedLog.after_data,
                    language === "th" ? "ข้อมูลหลังเปลี่ยนแปลง" : "After Data"
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
    </div>
  );
}
