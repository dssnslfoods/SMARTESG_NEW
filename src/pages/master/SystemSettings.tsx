import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Save, Loader2 } from "lucide-react";

const PAGE_SIZE_OPTIONS = ["10", "15", "25", "50", "100", "200"];
const MONTH_NAMES_TH = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
const MONTH_NAMES_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const KEYS = {
  pageSize: "data_entry_page_size",
  filterMode: "data_entry_filter_mode",
  recentMonths: "data_entry_recent_months",
  fromYear: "data_entry_from_year",
  fromMonth: "data_entry_from_month",
} as const;

type FilterMode = "recent" | "from" | "all";

export default function SystemSettings() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const monthNames = language === "th" ? MONTH_NAMES_TH : MONTH_NAMES_EN;

  const [pageSize, setPageSize] = useState<string>("15");
  const [filterMode, setFilterMode] = useState<FilterMode>("recent");
  const [recentMonths, setRecentMonths] = useState<string>("4");
  const currentYear = new Date().getFullYear();
  const [fromYear, setFromYear] = useState<string>(String(currentYear));
  const [fromMonth, setFromMonth] = useState<string>("1");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_setting")
        .select("key,value")
        .in("key", Object.values(KEYS));
      const map = new Map((data ?? []).map((r: any) => [r.key, r.value as string]));
      if (map.get(KEYS.pageSize)) setPageSize(map.get(KEYS.pageSize)!);
      if (map.get(KEYS.filterMode)) setFilterMode(map.get(KEYS.filterMode) as FilterMode);
      if (map.get(KEYS.recentMonths)) setRecentMonths(map.get(KEYS.recentMonths)!);
      if (map.get(KEYS.fromYear)) setFromYear(map.get(KEYS.fromYear)!);
      if (map.get(KEYS.fromMonth)) setFromMonth(map.get(KEYS.fromMonth)!);
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const rows = [
      { key: KEYS.pageSize, value: pageSize },
      { key: KEYS.filterMode, value: filterMode },
      { key: KEYS.recentMonths, value: recentMonths },
      { key: KEYS.fromYear, value: fromYear },
      { key: KEYS.fromMonth, value: fromMonth },
    ];
    const { error } = await supabase
      .from("app_setting")
      .upsert(rows, { onConflict: "key" });
    setSaving(false);
    if (error) {
      toast({
        title: language === "th" ? "เกิดข้อผิดพลาด" : "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: language === "th" ? "บันทึกสำเร็จ" : "Saved",
      description: language === "th" ? "บันทึกการตั้งค่าแล้ว" : "Settings saved",
    });
  };

  const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

  return (
    <div className="ios-page-enter space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/25">
          <Settings className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">
            {language === "th" ? "ตั้งค่าระบบ" : "System Settings"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {language === "th"
              ? "ค่าคอนฟิกส่วนกลางของแอปพลิเคชัน"
              : "Global application configuration"}
          </p>
        </div>
      </div>

      <Card className="rounded-3xl border-white/40 bg-white/70 backdrop-blur-xl">
        <CardHeader>
          <CardTitle>
            {language === "th" ? "การแสดงผลข้อมูล" : "Data Display"}
          </CardTitle>
          <CardDescription>
            {language === "th"
              ? "กำหนดจำนวนรายการต่อหน้าในหน้าบันทึกข้อมูล"
              : "Set the number of rows per page on the Data Entry list"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid max-w-sm gap-2">
            <Label>
              {language === "th"
                ? "จำนวนรายการต่อหน้า (Data Entry)"
                : "Rows per page (Data Entry)"}
            </Label>
            <Select value={pageSize} onValueChange={setPageSize} disabled={loading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-white/40 bg-white/70 backdrop-blur-xl">
        <CardHeader>
          <CardTitle>
            {language === "th" ? "ช่วงเวลาที่แสดงผล" : "Period Filter"}
          </CardTitle>
          <CardDescription>
            {language === "th"
              ? "กำหนดเดือน/ปีของรายการบันทึกข้อมูลที่ต้องการแสดง (รายการสถานะ 'ร่าง' จะแสดงเสมอ)"
              : "Choose which months/years to show in the Data Entry list (drafts are always shown)"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid max-w-sm gap-2">
            <Label>{language === "th" ? "รูปแบบ" : "Mode"}</Label>
            <Select
              value={filterMode}
              onValueChange={(v) => setFilterMode(v as FilterMode)}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">
                  {language === "th" ? "ย้อนหลัง N เดือน (จากเดือนล่าสุดในข้อมูล)" : "Recent N months (from latest in data)"}
                </SelectItem>
                <SelectItem value="from">
                  {language === "th" ? "ตั้งแต่เดือน/ปี ที่กำหนด" : "From a specific month/year onwards"}
                </SelectItem>
                <SelectItem value="all">
                  {language === "th" ? "แสดงทั้งหมด" : "Show all"}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filterMode === "recent" && (
            <div className="grid max-w-sm gap-2">
              <Label>
                {language === "th" ? "จำนวนเดือนย้อนหลัง" : "Number of recent months"}
              </Label>
              <Select value={recentMonths} onValueChange={setRecentMonths} disabled={loading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1,2,3,4,5,6,9,12,18,24].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} {language === "th" ? "เดือน" : n === 1 ? "month" : "months"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {filterMode === "from" && (
            <div className="grid max-w-md grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>{language === "th" ? "เดือน" : "Month"}</Label>
                <Select value={fromMonth} onValueChange={setFromMonth} disabled={loading}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthNames.map((name, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{language === "th" ? "ปี" : "Year"}</Label>
                <Select value={fromYear} onValueChange={setFromYear} disabled={loading}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <Button onClick={handleSave} disabled={saving || loading} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {language === "th" ? "บันทึก" : "Save"}
        </Button>
      </div>
    </div>
  );
}
