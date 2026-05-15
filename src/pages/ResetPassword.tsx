import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Leaf,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";

export function validatePassword(password: string, confirm: string, lang: "th" | "en"): string[] {
  const th = lang === "th";
  const errors: string[] = [];
  if (!password || password.length < 8)
    errors.push(th ? "อย่างน้อย 8 ตัวอักษร" : "At least 8 characters");
  if (!/[a-z]/.test(password))
    errors.push(th ? "ต้องมีตัวพิมพ์เล็ก (a-z)" : "Must contain lowercase (a-z)");
  if (!/[A-Z]/.test(password))
    errors.push(th ? "ต้องมีตัวพิมพ์ใหญ่ (A-Z)" : "Must contain uppercase (A-Z)");
  if (!/[0-9]/.test(password))
    errors.push(th ? "ต้องมีตัวเลข (0-9)" : "Must contain a number (0-9)");
  if (password !== confirm)
    errors.push(th ? "รหัสผ่านยืนยันไม่ตรงกัน" : "Passwords do not match");
  return errors;
}

function humanizeSupabaseError(message: string | undefined, lang: "th" | "en"): string {
  const th = lang === "th";
  if (!message) return th ? "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ" : "An unknown error occurred";
  const m = message.toLowerCase();
  if (m.includes("same as the old"))
    return th ? "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม" : "New password must differ from the old one";
  if (m.includes("weak password"))
    return th ? "รหัสผ่านอ่อนเกินไป กรุณาตั้งให้ซับซ้อนขึ้น" : "Password is too weak";
  if (m.includes("expired") || m.includes("invalid token"))
    return th
      ? "ลิงก์รีเซ็ตหมดอายุหรือถูกใช้งานแล้ว กรุณาขอลิงก์ใหม่"
      : "The reset link has expired or been used. Please request a new one";
  if (m.includes("auth session missing"))
    return th
      ? "ไม่พบเซสชันการรีเซ็ต กรุณากดลิงก์จากอีเมลใหม่อีกครั้ง"
      : "Recovery session not found. Please click the link from your email again";
  return message;
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { toast } = useToast();
  const th = language === "th";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);

  const [checkingLink, setCheckingLink] = useState(true);
  const [recoveryReady, setRecoveryReady] = useState(false);

  useEffect(() => {
    // Supabase JS อ่าน token จาก URL hash อัตโนมัติ แล้วยิง event PASSWORD_RECOVERY
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryReady(true);
        setCheckingLink(false);
      }
    });

    // เผื่อ event ยิงก่อน mount — ตรวจ session ที่มีอยู่
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) setRecoveryReady(true);
      setCheckingLink(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    const validationErrors = validatePassword(password, confirm, language as "th" | "en");
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        // ไม่ log password — log เฉพาะ message
        toast({
          variant: "destructive",
          title: th ? "ผิดพลาด" : "Error",
          description: humanizeSupabaseError(error.message, language as "th" | "en"),
        });
        return;
      }
      setSuccess(true);
      // sign out เพื่อบังคับให้ login ใหม่ด้วยรหัสที่เพิ่งตั้ง
      await supabase.auth.signOut();
      toast({
        title: th ? "สำเร็จ" : "Success",
        description: th ? "ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว" : "Password updated successfully",
      });
    } catch (err) {
      console.error("updateUser failed:", (err as Error)?.message ?? "unknown");
      toast({
        variant: "destructive",
        title: th ? "ผิดพลาด" : "Error",
        description: th ? "ไม่สามารถบันทึกรหัสผ่านได้" : "Failed to update password",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* ===== BACKGROUND LAYER ===== */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1509391366360-2e959784a276?w=1920&q=80')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-emerald-950/50 to-black/60" />
      <div className="absolute inset-0 backdrop-blur-[2px]" />

      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-emerald-500/20 blur-3xl animate-pulse" style={{ animationDuration: "4s" }} />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full bg-teal-400/15 blur-3xl animate-pulse" style={{ animationDuration: "6s" }} />

      {/* ===== TOP LOGO ===== */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center px-4 py-4 sm:px-8 sm:py-6">
        <div className="flex items-center gap-3 gl-fade-in">
          <div
            className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl border border-white/25 shadow-lg"
            style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(20px)" }}
          >
            <Leaf className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-300" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-bold text-white leading-none">ESG Smart Performance</p>
            <p className="text-xs text-white/50 mt-0.5">v2.5 — Sustainability Platform</p>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-24 sm:py-28">
        <div className="w-full max-w-[420px] md:max-w-[460px] gl-slide-up" style={{ animationDelay: "0.2s" }}>
          <div
            className="relative rounded-3xl border border-white/20 shadow-2xl overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(40px) saturate(180%)",
              WebkitBackdropFilter: "blur(40px) saturate(180%)",
              boxShadow:
                "0 32px 64px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(255,255,255,0.05)",
            }}
          >
            <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

            <div className="p-6 sm:p-8">
              {/* Icon + Title */}
              <div className="flex flex-col items-center mb-7 gl-fade-in" style={{ animationDelay: "0.3s" }}>
                <div
                  className="h-16 w-16 flex items-center justify-center rounded-3xl mb-4 border border-white/20"
                  style={{
                    background: "linear-gradient(135deg, rgba(52,211,153,0.4), rgba(20,184,166,0.3))",
                    backdropFilter: "blur(20px)",
                    boxShadow: "0 8px 32px rgba(52,211,153,0.3), inset 0 1px 0 rgba(255,255,255,0.2)",
                  }}
                >
                  {success ? (
                    <CheckCircle2 className="h-8 w-8 text-emerald-300" />
                  ) : !recoveryReady && !checkingLink ? (
                    <ShieldAlert className="h-8 w-8 text-amber-300" />
                  ) : (
                    <Lock className="h-8 w-8 text-emerald-300" />
                  )}
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight text-center">
                  {success
                    ? th ? "ตั้งรหัสผ่านสำเร็จ" : "Password Updated"
                    : !recoveryReady && !checkingLink
                    ? th ? "ลิงก์ไม่ถูกต้อง" : "Invalid Link"
                    : th ? "ตั้งรหัสผ่านใหม่" : "Reset Password"}
                </h2>
                <p className="text-white/50 text-sm mt-1 text-center">
                  {success
                    ? th ? "เข้าสู่ระบบด้วยรหัสผ่านใหม่ได้เลย" : "You can now sign in with your new password"
                    : !recoveryReady && !checkingLink
                    ? th ? "ลิงก์หมดอายุหรือถูกใช้งานแล้ว" : "Link has expired or been used"
                    : th ? "กรุณากำหนดรหัสผ่านใหม่ของคุณ" : "Please set your new password"}
                </p>
              </div>

              {/* Loading state */}
              {checkingLink && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-white/60" />
                </div>
              )}

              {/* Invalid link state */}
              {!checkingLink && !recoveryReady && !success && (
                <button
                  type="button"
                  onClick={() => navigate("/auth")}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl font-semibold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    height: "52px",
                    background: "linear-gradient(135deg, rgba(52,211,153,0.9), rgba(20,184,166,0.9))",
                    color: "white",
                    boxShadow: "0 8px 32px rgba(52,211,153,0.3), inset 0 1px 0 rgba(255,255,255,0.2)",
                  }}
                >
                  {th ? "กลับไปหน้าเข้าสู่ระบบ" : "Back to Sign In"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}

              {/* Success state */}
              {success && (
                <button
                  type="button"
                  onClick={() => navigate("/auth")}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl font-semibold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    height: "52px",
                    background: "linear-gradient(135deg, rgba(52,211,153,0.9), rgba(20,184,166,0.9))",
                    color: "white",
                    boxShadow: "0 8px 32px rgba(52,211,153,0.3), inset 0 1px 0 rgba(255,255,255,0.2)",
                  }}
                >
                  {th ? "ไปหน้าเข้าสู่ระบบ" : "Go to Sign In"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}

              {/* Form */}
              {!checkingLink && recoveryReady && !success && (
                <form onSubmit={handleSubmit} className="space-y-4 gl-fade-in" style={{ animationDelay: "0.4s" }} noValidate>
                  {/* New Password */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                      {th ? "รหัสผ่านใหม่" : "New Password"}
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                        className="pl-11 pr-12 text-sm text-white placeholder:text-white/30 rounded-2xl border-white/15 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
                        style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(8px)", height: "52px" }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-white/40 mt-1">
                      {th
                        ? "อย่างน้อย 8 ตัว • มีพิมพ์ใหญ่ พิมพ์เล็ก และตัวเลขอย่างละ 1 ตัว"
                        : "Min 8 chars • include uppercase, lowercase, and a number"}
                    </p>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                      {th ? "ยืนยันรหัสผ่าน" : "Confirm Password"}
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                      <Input
                        type={showConfirm ? "text" : "password"}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        disabled={isLoading}
                        className="pl-11 pr-12 text-sm text-white placeholder:text-white/30 rounded-2xl border-white/15 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
                        style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(8px)", height: "52px" }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                      >
                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {errors.length > 0 && (
                    <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 backdrop-blur-sm">
                      <ul className="space-y-0.5">
                        {errors.map((err, i) => (
                          <li key={i} className="text-xs text-red-300">• {err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl font-semibold text-sm transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] mt-2"
                    style={{
                      height: "52px",
                      background: "linear-gradient(135deg, rgba(52,211,153,0.9), rgba(20,184,166,0.9))",
                      backdropFilter: "blur(12px)",
                      color: "white",
                      boxShadow: "0 8px 32px rgba(52,211,153,0.3), inset 0 1px 0 rgba(255,255,255,0.2)",
                    }}
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        {th ? "บันทึกรหัสผ่านใหม่" : "Save New Password"}
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            <div className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>
        </div>

        <p className="mt-8 text-xs text-white/30 text-center gl-fade-in" style={{ animationDelay: "0.6s" }}>
          © 2026 ESG Smart Performance | Developed by Arnon Arpaket
        </p>
      </div>

      <style>{`
        @keyframes glFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes glSlideUp {
          from { opacity: 0; transform: translateY(32px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)  scale(1); }
        }
        .gl-fade-in  { animation: glFadeIn  0.7s cubic-bezier(0.16,1,0.3,1) both; }
        .gl-slide-up { animation: glSlideUp 0.8s cubic-bezier(0.16,1,0.3,1) both; }
      `}</style>
    </div>
  );
}
