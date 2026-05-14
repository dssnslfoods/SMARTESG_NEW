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
const KEY = "data_entry_page_size";

export default function SystemSettings() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [pageSize, setPageSize] = useState<string>("15");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_setting")
        .select("value")
        .eq("key", KEY)
        .maybeSingle();
      if (data?.value) setPageSize(data.value);
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("app_setting")
      .upsert({ key: KEY, value: pageSize }, { onConflict: "key" });
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
      description:
        language === "th"
          ? `ตั้งค่าจำนวนรายการต่อหน้าเป็น ${pageSize}`
          : `Page size set to ${pageSize}`,
    });
  };

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
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSave} disabled={saving || loading} className="gap-2">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {language === "th" ? "บันทึก" : "Save"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
