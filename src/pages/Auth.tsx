import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Globe,
  Leaf,
  Mail,
  Lock,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  Thermometer,
  TreePine,
  Wind,
  Sparkles,
  Earth,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const emailSchema = z.string().email();

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signupSchema = z
  .object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
    fullName: z.string().min(2, "Name must be at least 2 characters"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export default function Auth() {
  const { user, signIn, signUp, loading } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });

  // Forgot password dialog state
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState("");

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");

    const parsed = emailSchema.safeParse(forgotEmail.trim());
    if (!parsed.success) {
      setForgotError(language === "th" ? "กรุณากรอกอีเมลให้ถูกต้อง" : "Please enter a valid email");
      return;
    }

    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotLoading(false);

    if (error) {
      setForgotError(
        language === "th"
          ? `ส่งอีเมลไม่สำเร็จ: ${error.message}`
          : `Failed to send email: ${error.message}`,
      );
      return;
    }
    setForgotSent(true);
  };

  const openForgotDialog = () => {
    setForgotEmail(loginForm.email || "");
    setForgotSent(false);
    setForgotError("");
    setForgotOpen(true);
  };
  const [signupForm, setSignupForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (loading) {
    return (
      <div
        className="flex h-screen items-center justify-center"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <div className="relative flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/20 backdrop-blur-2xl shadow-2xl border border-white/30">
            <Leaf className="h-8 w-8 text-white animate-pulse" />
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-white/80" />
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    try {
      loginSchema.parse(loginForm);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        err.errors.forEach((error) => {
          if (error.path[0]) fieldErrors[error.path[0] as string] = error.message;
        });
        setErrors(fieldErrors);
        return;
      }
    }
    setIsLoading(true);
    const { error, inactive } = await signIn(loginForm.email, loginForm.password);
    setIsLoading(false);
    if (error) {
      toast({ variant: "destructive", title: t("error"), description: error.message });
    } else if (inactive) {
      toast({
        variant: "destructive",
        title: language === "th" ? "บัญชีถูกระงับ" : "Account Inactive",
        description:
          language === "th"
            ? "บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ"
            : "Your account has been deactivated. Please contact an administrator.",
      });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    try {
      signupSchema.parse(signupForm);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        err.errors.forEach((error) => {
          if (error.path[0]) fieldErrors[error.path[0] as string] = error.message;
        });
        setErrors(fieldErrors);
        return;
      }
    }
    setIsLoading(true);
    const { error } = await signUp(signupForm.email, signupForm.password, signupForm.fullName);
    setIsLoading(false);
    if (error) {
      toast({ variant: "destructive", title: t("error"), description: error.message });
    } else {
      toast({
        title: t("success"),
        description:
          language === "th"
            ? "สมัครสมาชิกสำเร็จ กรุณารอการอนุมัติบทบาทจากผู้ดูแลระบบ"
            : "Sign up successful. Please wait for role assignment from an administrator.",
      });
    }
  };

  const stats = [
    { icon: Thermometer, value: "1.5°C", label: language === "th" ? "เป้าหมาย" : "Target" },
    { icon: TreePine, value: "Net 0", label: language === "th" ? "คาร์บอน" : "Carbon" },
    { icon: Wind, value: "ESG", label: language === "th" ? "ความยั่งยืน" : "Sustain." },
  ];

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* ===== BACKGROUND LAYER ===== */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      {/* Multi-layer glass tint — Earth from space / Global Warming theme */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/80 via-emerald-950/60 to-blue-950/70" />
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-amber-900/10 to-transparent" />
      <div className="absolute inset-0 backdrop-blur-[3px]" />

      {/* ===== FLOATING ORB DECORATIONS (warming + cooling) ===== */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-emerald-500/20 blur-3xl animate-pulse" style={{ animationDuration: "4s" }} />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full bg-sky-400/15 blur-3xl animate-pulse" style={{ animationDuration: "6s" }} />
      <div className="absolute top-1/2 left-1/4 w-48 h-48 rounded-full bg-amber-400/10 blur-2xl animate-pulse" style={{ animationDuration: "5s" }} />
      <div className="absolute top-1/3 right-1/4 w-64 h-64 rounded-full bg-teal-300/10 blur-3xl animate-pulse" style={{ animationDuration: "7s" }} />

      {/* ===== TOP BAR ===== */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-4 sm:px-8 sm:py-6">
        {/* Logo */}
        <div className="flex items-center gap-3 gl-fade-in">
          <div
            className="relative flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl border border-white/25 shadow-lg"
            style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(20px)" }}
          >
            <Earth className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-300" />
            {/* Pulsing dot indicating "new" */}
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500 border border-white/40" />
            </span>
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-white leading-none">ESG Smart Performance</p>
              <span
                className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded-md border border-amber-300/40 text-amber-200"
                style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.25), rgba(251,191,36,0.15))" }}
              >
                NEW HOST
              </span>
            </div>
            <p className="text-xs text-white/50 mt-0.5">v2.6 — Climate Action Platform</p>
          </div>
        </div>

        {/* Language Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 border border-white/20 text-white/80 hover:text-white hover:bg-white/15 backdrop-blur-xl rounded-xl transition-all duration-200"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <Globe className="h-4 w-4" />
              <span className="text-xs font-semibold">{language === "th" ? "ไทย" : "EN"}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-[120px] rounded-2xl border border-white/20 shadow-2xl"
            style={{ background: "rgba(15,25,20,0.85)", backdropFilter: "blur(32px)" }}
          >
            <DropdownMenuItem onClick={() => setLanguage("th")} className="gap-3 cursor-pointer rounded-xl text-white/80 hover:text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">
              <span>🇹🇭</span><span>ไทย</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLanguage("en")} className="gap-3 cursor-pointer rounded-xl text-white/80 hover:text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">
              <span>🇺🇸</span><span>English</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-24 sm:py-28">

        {/* Brand heading — desktop only */}
        <div className="hidden lg:block text-center mb-8 gl-fade-in" style={{ animationDelay: "0.1s" }}>
          <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full border border-amber-300/30 bg-amber-500/10 backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            <span className="text-xs font-semibold text-amber-200 tracking-wider">
              {language === "th" ? "ระบบย้ายมาที่ Host ใหม่แล้ว" : "Migrated to New Host"}
            </span>
          </div>
          <h1 className="text-5xl xl:text-6xl font-black tracking-tight text-white leading-none">
            {language === "th" ? "ร่วมต่อสู้" : "Combat"}
          </h1>
          <h1
            className="text-5xl xl:text-6xl font-black tracking-tight leading-none mt-1"
            style={{
              background: "linear-gradient(135deg, #fbbf24, #f59e0b, #6ee7b7, #14b8a6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundSize: "200% 200%",
              animation: "shimmer 6s ease-in-out infinite",
            }}
          >
            {language === "th" ? "ภาวะโลกร้อน" : "Global Warming"}
          </h1>
          <p className="text-white/60 mt-4 text-base">{language === "th" ? "บริษัท เอ็นเอสแอล ฟู้ดส์ จำกัด (มหาชน)" : "NSL FOODS Public Company Limited"}</p>
          <p className="text-white/40 mt-1 text-xs tracking-widest uppercase">
            {language === "th" ? "ขับเคลื่อนความยั่งยืนเพื่ออนาคต" : "Sustainability for the Future"}
          </p>
        </div>

        {/* ===== GLASS CARD ===== */}
        <div
          className="w-full max-w-[420px] md:max-w-[460px] gl-slide-up"
          style={{ animationDelay: "0.2s" }}
        >
          <div
            className="relative rounded-3xl border border-white/20 shadow-2xl overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(40px) saturate(180%)",
              WebkitBackdropFilter: "blur(40px) saturate(180%)",
              boxShadow: "0 32px 64px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(255,255,255,0.05)",
            }}
          >
            {/* Inner top highlight line */}
            <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

            <div className="p-6 sm:p-8">
              {/* ===== Mobile: Migration banner inside card ===== */}
              <div className="lg:hidden mb-5 rounded-2xl border border-amber-300/30 bg-amber-500/10 backdrop-blur-md px-3 py-2 gl-fade-in" style={{ animationDelay: "0.25s" }}>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-300 shrink-0" />
                  <span className="text-xs font-semibold text-amber-100">
                    {language === "th" ? "ระบบย้ายมา Host ใหม่แล้ว — v2.6" : "New Host — v2.6"}
                  </span>
                </div>
              </div>

              {/* Icon + Title */}
              <div className="flex flex-col items-center mb-7 gl-fade-in" style={{ animationDelay: "0.3s" }}>
                <div
                  className="relative h-16 w-16 flex items-center justify-center rounded-3xl mb-4 border border-white/20"
                  style={{
                    background: "linear-gradient(135deg, rgba(52,211,153,0.4), rgba(20,184,166,0.3))",
                    backdropFilter: "blur(20px)",
                    boxShadow: "0 8px 32px rgba(52,211,153,0.3), inset 0 1px 0 rgba(255,255,255,0.2)",
                  }}
                >
                  <Earth className="h-8 w-8 text-emerald-300" />
                  {/* Orbit ring */}
                  <span
                    className="pointer-events-none absolute inset-0 rounded-3xl border border-emerald-300/30"
                    style={{ animation: "spin 12s linear infinite" }}
                  />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  {activeTab === "login"
                    ? (language === "th" ? "ยินดีต้อนรับ" : "Welcome Back")
                    : (language === "th" ? "สมัครสมาชิก" : "Create Account")}
                </h2>
                <p className="text-white/50 text-sm mt-1">
                  {activeTab === "login"
                    ? (language === "th" ? "เข้าสู่ระบบเพื่อดำเนินการต่อ" : "Sign in to continue")
                    : (language === "th" ? "กรอกข้อมูลเพื่อสร้างบัญชีใหม่" : "Fill in your details to get started")}
                </p>
              </div>

              {/* Tab Pills */}
              <div
                className="flex rounded-2xl p-1 mb-7 gl-fade-in"
                style={{ background: "rgba(0,0,0,0.25)", animationDelay: "0.35s" }}
              >
                {(["login", "signup"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => { setActiveTab(tab); setErrors({}); }}
                    className="flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300"
                    style={
                      activeTab === tab
                        ? {
                            background: "rgba(255,255,255,0.15)",
                            backdropFilter: "blur(12px)",
                            color: "rgba(255,255,255,1)",
                            boxShadow: "0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)",
                          }
                        : { color: "rgba(255,255,255,0.45)" }
                    }
                  >
                    {tab === "login" ? t("login") : t("signup")}
                  </button>
                ))}
              </div>

              {/* ===== LOGIN FORM ===== */}
              {activeTab === "login" && (
                <form onSubmit={handleLogin} className="space-y-4 gl-fade-in" style={{ animationDelay: "0.4s" }}>
                  {/* Email */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-white/60 uppercase tracking-wider">{t("email")}</Label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        value={loginForm.email}
                        onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                        disabled={isLoading}
                        className="h-13 pl-11 pr-4 text-sm text-white placeholder:text-white/30 rounded-2xl border-white/15 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
                        style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(8px)", height: "52px" }}
                      />
                    </div>
                    {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email}</p>}
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-white/60 uppercase tracking-wider">{t("password")}</Label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                        disabled={isLoading}
                        className="h-13 pl-11 pr-12 text-sm text-white placeholder:text-white/30 rounded-2xl border-white/15 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
                        style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(8px)", height: "52px" }}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password}</p>}
                  </div>

                  {/* Remember & Forgot */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="remember"
                        checked={rememberMe}
                        onCheckedChange={(c) => setRememberMe(c as boolean)}
                        className="h-4 w-4 rounded-md border-white/30 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                      />
                      <Label htmlFor="remember" className="text-xs text-white/50 cursor-pointer">
                        {language === "th" ? "จดจำฉัน" : "Remember me"}
                      </Label>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                      onClick={openForgotDialog}
                    >
                      {language === "th" ? "ลืมรหัสผ่าน?" : "Forgot password?"}
                    </button>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-13 flex items-center justify-center gap-2 rounded-2xl font-semibold text-sm transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      height: "52px",
                      background: "linear-gradient(135deg, rgba(52,211,153,0.9), rgba(20,184,166,0.9))",
                      backdropFilter: "blur(12px)",
                      color: "white",
                      boxShadow: "0 8px 32px rgba(52,211,153,0.3), inset 0 1px 0 rgba(255,255,255,0.2)",
                    }}
                  >
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                      <>{language === "th" ? "เข้าสู่ระบบ" : "Sign In"}<ArrowRight className="h-4 w-4" /></>
                    )}
                  </button>
                </form>
              )}

              {/* ===== SIGNUP FORM ===== */}
              {activeTab === "signup" && (
                <form onSubmit={handleSignup} className="space-y-4 gl-fade-in" style={{ animationDelay: "0.4s" }}>
                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-white/60 uppercase tracking-wider">{t("fullName")}</Label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                      <Input
                        type="text"
                        placeholder={language === "th" ? "ชื่อ-นามสกุล" : "Full Name"}
                        value={signupForm.fullName}
                        onChange={(e) => setSignupForm({ ...signupForm, fullName: e.target.value })}
                        disabled={isLoading}
                        className="pl-11 pr-4 text-sm text-white placeholder:text-white/30 rounded-2xl border-white/15 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
                        style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(8px)", height: "52px" }}
                      />
                    </div>
                    {errors.fullName && <p className="text-xs text-red-400">{errors.fullName}</p>}
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-white/60 uppercase tracking-wider">{t("email")}</Label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        value={signupForm.email}
                        onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                        disabled={isLoading}
                        className="pl-11 pr-4 text-sm text-white placeholder:text-white/30 rounded-2xl border-white/15 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
                        style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(8px)", height: "52px" }}
                      />
                    </div>
                    {errors.email && <p className="text-xs text-red-400">{errors.email}</p>}
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-white/60 uppercase tracking-wider">{t("password")}</Label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={signupForm.password}
                        onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                        disabled={isLoading}
                        className="pl-11 pr-12 text-sm text-white placeholder:text-white/30 rounded-2xl border-white/15 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
                        style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(8px)", height: "52px" }}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.password && <p className="text-xs text-red-400">{errors.password}</p>}
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-white/60 uppercase tracking-wider">{t("confirmPassword")}</Label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={signupForm.confirmPassword}
                        onChange={(e) => setSignupForm({ ...signupForm, confirmPassword: e.target.value })}
                        disabled={isLoading}
                        className="pl-11 pr-12 text-sm text-white placeholder:text-white/30 rounded-2xl border-white/15 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
                        style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(8px)", height: "52px" }}
                      />
                      <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors">
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.confirmPassword && <p className="text-xs text-red-400">{errors.confirmPassword}</p>}
                  </div>

                  {/* Submit */}
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
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                      <>{language === "th" ? "สมัครสมาชิก" : "Sign Up"}<ArrowRight className="h-4 w-4" /></>
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* Bottom highlight line */}
            <div className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>

          {/* Stats row — below card */}
          <div className="mt-5 grid grid-cols-3 gap-3 gl-fade-in" style={{ animationDelay: "0.5s" }}>
            {stats.map(({ icon: Icon, value, label }, i) => (
              <div
                key={i}
                className="flex flex-col items-center py-3 px-2 rounded-2xl border border-white/10"
                style={{ background: "rgba(255,255,255,0.06)", backdropFilter: "blur(20px)" }}
              >
                <Icon className="h-4 w-4 text-emerald-400 mb-1.5" />
                <span className="text-white font-bold text-sm leading-none">{value}</span>
                <span className="text-white/40 text-xs mt-1">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="mt-8 text-xs text-white/30 text-center gl-fade-in" style={{ animationDelay: "0.6s" }}>
          © 2026 ESG Smart Performance | Developed by Arnon Arpaket
        </p>
      </div>

      {/* ===== FORGOT PASSWORD DIALOG ===== */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-[440px] rounded-2xl border-slate-200">
          <DialogHeader>
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100">
              {forgotSent ? (
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              ) : (
                <KeyRound className="h-7 w-7 text-emerald-600" />
              )}
            </div>
            <DialogTitle className="text-center text-xl">
              {forgotSent
                ? (language === "th" ? "ส่งลิงก์รีเซ็ตแล้ว" : "Reset link sent")
                : (language === "th" ? "ลืมรหัสผ่าน?" : "Forgot password?")}
            </DialogTitle>
            <DialogDescription className="text-center">
              {forgotSent
                ? (language === "th"
                    ? "กรุณาตรวจสอบอีเมลของคุณ (รวมถึงโฟลเดอร์ Spam) แล้วกดลิงก์เพื่อตั้งรหัสผ่านใหม่"
                    : "Please check your email (including Spam folder) and click the link to set a new password.")
                : (language === "th"
                    ? "กรอกอีเมลที่ใช้สมัคร ระบบจะส่งลิงก์รีเซ็ตรหัสผ่านไปให้"
                    : "Enter your registered email and we'll send you a reset link.")}
            </DialogDescription>
          </DialogHeader>

          {!forgotSent ? (
            <form onSubmit={handleForgotPassword} className="space-y-4 mt-2" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="forgot-email" className="text-sm font-medium text-slate-700">
                  {language === "th" ? "อีเมล" : "Email"}
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="your@email.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    disabled={forgotLoading}
                    autoComplete="email"
                    autoFocus
                    className="pl-10 h-11"
                  />
                </div>
                {forgotError && (
                  <p className="text-xs text-red-600 mt-1">{forgotError}</p>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setForgotOpen(false)}
                  disabled={forgotLoading}
                >
                  {language === "th" ? "ยกเลิก" : "Cancel"}
                </Button>
                <Button
                  type="submit"
                  disabled={forgotLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {forgotLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {language === "th" ? "กำลังส่ง..." : "Sending..."}
                    </>
                  ) : (
                    <>{language === "th" ? "ส่งลิงก์รีเซ็ต" : "Send reset link"}</>
                  )}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <DialogFooter className="mt-2">
              <Button
                type="button"
                onClick={() => setForgotOpen(false)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {language === "th" ? "เข้าใจแล้ว" : "Got it"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== KEYFRAME ANIMATIONS ===== */}
      <style>{`
        @keyframes glFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes glSlideUp {
          from { opacity: 0; transform: translateY(32px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)  scale(1); }
        }
        @keyframes shimmer {
          0%, 100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
        .gl-fade-in  { animation: glFadeIn  0.7s cubic-bezier(0.16,1,0.3,1) both; }
        .gl-slide-up { animation: glSlideUp 0.8s cubic-bezier(0.16,1,0.3,1) both; }
      `}</style>
    </div>
  );
}
