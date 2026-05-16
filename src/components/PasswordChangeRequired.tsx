import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";

function validateStrength(pwd: string) {
  return {
    length: pwd.length >= 8,
    lower: /[a-z]/.test(pwd),
    upper: /[A-Z]/.test(pwd),
    number: /[0-9]/.test(pwd),
  };
}

/**
 * Globally-mounted blocking modal that appears when the user must change their
 * password (because admin/supervisor reset it for them).
 *
 * Shows only when:
 *  - user is logged in
 *  - profile.must_change_password === true
 */
export default function PasswordChangeRequired() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const th = language === "th";

  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const open = !!user && !!profile && profile.must_change_password === true;
  if (!open) return null;

  const strength = validateStrength(pwd);
  const allOk = strength.length && strength.lower && strength.upper && strength.number;
  const matches = pwd.length > 0 && pwd === confirm;
  const canSubmit = allOk && matches && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!allOk) {
      setError(th ? "รหัสผ่านไม่เป็นไปตามเงื่อนไข" : "Password does not meet requirements");
      return;
    }
    if (!matches) {
      setError(th ? "รหัสผ่านยืนยันไม่ตรงกัน" : "Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      // 1. Update auth password
      const { error: updateError } = await supabase.auth.updateUser({ password: pwd });
      if (updateError) {
        setError(updateError.message);
        return;
      }

      // 2. Clear the flag in app_user_profile
      const { error: flagError } = await supabase
        .from("app_user_profile")
        .update({ must_change_password: false })
        .eq("user_id", user!.id);
      if (flagError) {
        // Non-fatal: password is changed, just couldn't clear flag
        console.error("Failed to clear must_change_password flag:", flagError);
      }

      // 3. Refresh profile so the modal disappears
      await refreshProfile();

      toast({
        title: th ? "สำเร็จ" : "Success",
        description: th ? "ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว" : "Password updated successfully",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-[560px] max-h-[92vh] overflow-y-auto rounded-3xl"
        // Block all dismissal interactions — user MUST change password
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        // Hide default close button via CSS
        style={{}}
      >
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100">
            <ShieldAlert className="h-7 w-7 text-amber-600" />
          </div>
          <DialogTitle className="text-center text-xl">
            {th ? "กรุณาตั้งรหัสผ่านใหม่" : "Please Set a New Password"}
          </DialogTitle>
        </DialogHeader>

        {/* Notice */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
          {th ? (
            <>
              <p className="font-semibold mb-1">🔐 รหัสผ่านของคุณถูกรีเซ็ตโดยผู้ดูแลระบบ</p>
              <p>
                เพื่อความปลอดภัย กรุณาตั้งรหัสผ่านใหม่ที่<strong>เฉพาะคุณเท่านั้นที่ทราบ</strong> ก่อนใช้งานระบบต่อ
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold mb-1">🔐 Your password was reset by an administrator</p>
              <p>
                For security, please choose a new password that <strong>only you know</strong> before continuing.
              </p>
            </>
          )}
        </div>

        {/* Instructions */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm">
          <p className="font-semibold text-slate-700 mb-2">
            {th ? "วิธีการตั้งรหัสผ่านใหม่" : "How to set your new password"}
          </p>
          <ol className="list-decimal list-inside space-y-1 text-slate-600">
            {th ? (
              <>
                <li>กรอกรหัสผ่านใหม่ในช่อง "รหัสผ่านใหม่" ด้านล่าง</li>
                <li>กรอกซ้ำในช่อง "ยืนยันรหัสผ่าน" ให้ตรงกัน</li>
                <li>ต้องผ่านเงื่อนไขความปลอดภัยทุกข้อ (ดูรายการด้านล่าง)</li>
                <li>กดปุ่ม "บันทึกรหัสผ่านใหม่" — ระบบจะอนุญาตให้ใช้งานต่อ</li>
              </>
            ) : (
              <>
                <li>Enter your new password in the "New Password" field below</li>
                <li>Re-enter the same value in "Confirm Password"</li>
                <li>Must satisfy all security requirements (listed below)</li>
                <li>Click "Save New Password" — you'll regain access immediately</li>
              </>
            )}
          </ol>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-pwd">{th ? "รหัสผ่านใหม่" : "New Password"}</Label>
            <div className="relative">
              <Input
                id="new-pwd"
                type={show ? "text" : "password"}
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                autoComplete="new-password"
                autoFocus
                disabled={loading}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-pwd">{th ? "ยืนยันรหัสผ่าน" : "Confirm Password"}</Label>
            <Input
              id="confirm-pwd"
              type={show ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              disabled={loading}
            />
          </div>

          {/* Requirement checklist */}
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs space-y-1">
            <Check ok={strength.length}>
              {th ? "อย่างน้อย 8 ตัวอักษร" : "At least 8 characters"}
            </Check>
            <Check ok={strength.lower}>
              {th ? "มีตัวพิมพ์เล็ก (a-z) อย่างน้อย 1 ตัว" : "At least one lowercase letter (a-z)"}
            </Check>
            <Check ok={strength.upper}>
              {th ? "มีตัวพิมพ์ใหญ่ (A-Z) อย่างน้อย 1 ตัว" : "At least one uppercase letter (A-Z)"}
            </Check>
            <Check ok={strength.number}>
              {th ? "มีตัวเลข (0-9) อย่างน้อย 1 ตัว" : "At least one digit (0-9)"}
            </Check>
            <Check ok={matches}>
              {th ? "รหัสผ่านและยืนยันตรงกัน" : "Both fields match"}
            </Check>
          </div>

          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              disabled={loading}
              onClick={() => signOut()}
              className="text-slate-500"
            >
              {th ? "ออกจากระบบ" : "Sign out"}
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {th ? "กำลังบันทึก..." : "Saving..."}
                </>
              ) : (
                <>{th ? "บันทึกรหัสผ่านใหม่" : "Save New Password"}</>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex items-center gap-2 ${ok ? "text-emerald-700" : "text-slate-400"}`}>
      <CheckCircle2 className={`h-3.5 w-3.5 ${ok ? "opacity-100" : "opacity-40"}`} />
      <span>{children}</span>
    </div>
  );
}
