import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Globe, Leaf, Shield, BarChart3, Users, Mail, Lock, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { z } from "zod";

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

  const [isLoading, setIsLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [signupForm, setSignupForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-emerald-800 via-emerald-600 to-teal-500">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md shadow-lg">
            <Leaf className="h-8 w-8 text-white animate-pulse" />
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-white" />
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
          if (error.path[0]) {
            fieldErrors[error.path[0] as string] = error.message;
          }
        });
        setErrors(fieldErrors);
        return;
      }
    }

    setIsLoading(true);
    const { error, inactive } = await signIn(loginForm.email, loginForm.password);
    setIsLoading(false);

    if (error) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: error.message,
      });
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
          if (error.path[0]) {
            fieldErrors[error.path[0] as string] = error.message;
          }
        });
        setErrors(fieldErrors);
        return;
      }
    }

    setIsLoading(true);
    const { error } = await signUp(signupForm.email, signupForm.password, signupForm.fullName);
    setIsLoading(false);

    if (error) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: error.message,
      });
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

  const features = [
    {
      icon: BarChart3,
      title: language === "th" ? "รายงาน ESG" : "ESG Reporting",
      description:
        language === "th" ? "ติดตามผลการดำเนินงานด้านความยั่งยืน" : "Track sustainability performance metrics",
    },
    {
      icon: Shield,
      title: language === "th" ? "การกำกับดูแล" : "Governance",
      description: language === "th" ? "ระบบควบคุมและตรวจสอบภายใน" : "Internal control and audit systems",
    },
    {
      icon: Users,
      title: language === "th" ? "การมีส่วนร่วม" : "Stakeholder Engagement",
      description: language === "th" ? "เชื่อมต่อกับผู้มีส่วนได้ส่วนเสีย" : "Connect with all stakeholders",
    },
  ];

  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Branding with Liquid Glass */}
      <div className="hidden lg:flex lg:w-[55%] flex-col justify-between bg-gradient-to-br from-emerald-800 via-emerald-600 to-teal-500 p-16 text-white relative overflow-hidden">
        {/* Floating Glass Orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-10 h-64 w-64 rounded-full bg-white/10 backdrop-blur-3xl animate-float-slow" />
          <div className="absolute bottom-32 right-20 h-80 w-80 rounded-full bg-white/5 backdrop-blur-3xl animate-float-slow" style={{ animationDelay: '2s' }} />
          <div className="absolute top-1/2 left-1/3 h-48 w-48 rounded-full bg-white/8 backdrop-blur-3xl animate-float-slow" style={{ animationDelay: '4s' }} />
        </div>

        <div className="relative z-10">
          {/* Logo with Glass Container */}
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md shadow-lg ring-1 ring-white/20 border border-white/20">
              <Leaf className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">ESG Smart Performance</h1>
              <p className="text-sm text-white/70 font-medium">Sustainability Platform v2.0</p>
            </div>
          </div>
        </div>

        <div className="space-y-10 relative z-10">
          <div>
            <h2 className="text-4xl font-bold leading-tight tracking-tight whitespace-pre-line">
              {language === "th"
                ? "ขับเคลื่อนองค์กรสู่ความยั่งยืน"
                : "Driving Your Organization\nTowards Sustainability"}
            </h2>
            <p className="mt-6 text-lg text-white/80 max-w-lg leading-relaxed">
              {language === "th" ? "บริษัท เอ็นเอสแอล ฟู้ดส์ จำกัด (มหาชน)" : "NSL FOODS Public Company Limited"}
            </p>
          </div>

          {/* Glass Feature Cards */}
          <div className="space-y-4">
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex items-start gap-4 rounded-2xl bg-white/10 backdrop-blur-md p-5 border border-white/20 transition-all duration-300 hover:bg-white/15 hover:translate-x-1 hover:shadow-lg"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shadow-sm border border-white/10">
                  <feature.icon className="h-6 w-6" />
                </div>
                <div className="pt-1">
                  <h3 className="font-semibold text-base">{feature.title}</h3>
                  <p className="text-sm text-white/70 mt-1">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm text-white/50 relative z-10">
          © 2026 ESG Smart Performance | Developed by Arnon Arpaket.
          <br />
          All software and design assets are protected. Unauthorized use or reproduction is prohibited.
        </p>
      </div>

      {/* Right Panel - Auth Forms with Liquid Glass */}
      <div className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 px-4 py-6 sm:p-8 lg:p-16 relative min-h-screen">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
              backgroundSize: "40px 40px",
            }}
          />
        </div>

        {/* Language Switcher */}
        <div className="absolute right-4 top-4 sm:right-8 sm:top-8">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 bg-white/60 backdrop-blur-sm border-gray-200/80 hover:bg-white/80 hover:border-gray-300 transition-all duration-200 shadow-sm rounded-xl"
              >
                <Globe className="h-4 w-4 text-gray-500" />
                <span className="font-medium text-gray-700">{language === "th" ? "ไทย" : "EN"}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[120px] bg-white/80 backdrop-blur-xl border-white/50 rounded-xl">
              <DropdownMenuItem onClick={() => setLanguage("th")} className="gap-3 cursor-pointer rounded-lg">
                <span>🇹🇭</span>
                <span>ไทย</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLanguage("en")} className="gap-3 cursor-pointer rounded-lg">
                <span>🇺🇸</span>
                <span>English</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mobile Logo */}
        <div className="mb-6 sm:mb-10 text-center lg:hidden mt-8 sm:mt-0">
          <div className="mb-3 sm:mb-5 inline-flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-500 shadow-xl shadow-emerald-500/30">
            <Leaf className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">{t("appName")}</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            {language === "th" ? "ระบบจัดการความยั่งยืน v2.0" : "Sustainability Platform v2.0"}
          </p>
        </div>

        {/* Glass Login Card */}
        <Card className="w-full max-w-[420px] border border-white/50 shadow-2xl shadow-emerald-900/10 bg-white/70 backdrop-blur-2xl relative z-10 rounded-3xl">
          <Tabs defaultValue="login">
            <CardHeader className="space-y-3 sm:space-y-4 pb-3 sm:pb-4 pt-6 sm:pt-8 px-4 sm:px-8">
              <div className="text-center space-y-1.5 sm:space-y-2">
                <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
                  {language === "th" ? "ยินดีต้อนรับ" : "Welcome"}
                </CardTitle>
                <CardDescription className="text-gray-500 text-xs sm:text-sm">
                  {language === "th" ? "เข้าสู่ระบบหรือสร้างบัญชีใหม่" : "Sign in or create a new account"}
                </CardDescription>
              </div>
              {/* Glass Pill Tab Switcher */}
              <TabsList className="grid w-full grid-cols-2 h-10 sm:h-12 p-1.5 bg-gray-100/80 rounded-2xl">
                <TabsTrigger
                  value="login"
                  className="text-xs sm:text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-gray-900 transition-all duration-200 rounded-xl text-gray-600"
                >
                  {t("login")}
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="text-xs sm:text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-gray-900 transition-all duration-200 rounded-xl text-gray-600"
                >
                  {t("signup")}
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="pt-2 pb-6 sm:pb-8 px-4 sm:px-8">
              {/* Login Form */}
              <TabsContent value="login" className="mt-0">
                <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="login-email" className="text-xs sm:text-sm font-medium text-gray-700">
                      {t("email")}
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="email@example.com"
                        value={loginForm.email}
                        onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                        disabled={isLoading}
                        className="h-11 sm:h-12 pl-10 pr-4 text-sm sm:text-base bg-white/60 backdrop-blur border-gray-200/80 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-all duration-200 placeholder:text-gray-400 rounded-2xl"
                      />
                    </div>
                    {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                  </div>

                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="login-password" className="text-xs sm:text-sm font-medium text-gray-700">
                      {t("password")}
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="login-password"
                        type="password"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                        disabled={isLoading}
                        className="h-11 sm:h-12 pl-10 pr-4 text-sm sm:text-base bg-white/60 backdrop-blur border-gray-200/80 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-all duration-200 rounded-2xl"
                      />
                    </div>
                    {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
                  </div>

                  {/* Forgot Password Link */}
                  <div className="text-right">
                    <button
                      type="button"
                      className="text-xs sm:text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
                      onClick={() => toast({
                        title: language === "th" ? "ลืมรหัสผ่าน" : "Forgot Password",
                        description: language === "th" ? "กรุณาติดต่อผู้ดูแลระบบ" : "Please contact your administrator",
                      })}
                    >
                      {language === "th" ? "ลืมรหัสผ่าน?" : "Forgot password?"}
                    </button>
                  </div>

                  {/* Gradient Login Button */}
                  <Button
                    type="submit"
                    className="w-full h-11 sm:h-12 text-sm sm:text-base font-semibold bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 mt-2 rounded-2xl border-0"
                    disabled={isLoading}
                  >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("login")}
                  </Button>

                  {/* Social Login Divider */}
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200/80"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-white/70 px-3 text-gray-500">
                        {language === "th" ? "หรือเข้าสู่ระบบด้วย" : "or continue with"}
                      </span>
                    </div>
                  </div>

                  {/* Social Login Buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 bg-white/60 backdrop-blur border-gray-200/80 hover:bg-white/80 hover:border-gray-300 transition-all duration-200 rounded-xl text-gray-700 font-medium"
                      onClick={() => toast({
                        title: "Google",
                        description: language === "th" ? "ยังไม่พร้อมใช้งาน" : "Coming soon",
                      })}
                    >
                      <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Google
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 bg-white/60 backdrop-blur border-gray-200/80 hover:bg-white/80 hover:border-gray-300 transition-all duration-200 rounded-xl text-gray-700 font-medium"
                      onClick={() => toast({
                        title: "Microsoft",
                        description: language === "th" ? "ยังไม่พร้อมใช้งาน" : "Coming soon",
                      })}
                    >
                      <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                        <path fill="#F25022" d="M1 1h10v10H1z"/>
                        <path fill="#00A4EF" d="M1 13h10v10H1z"/>
                        <path fill="#7FBA00" d="M13 1h10v10H13z"/>
                        <path fill="#FFB900" d="M13 13h10v10H13z"/>
                      </svg>
                      Microsoft
                    </Button>
                  </div>
                </form>
              </TabsContent>

              {/* Signup Form */}
              <TabsContent value="signup" className="mt-0">
                <form onSubmit={handleSignup} className="space-y-3 sm:space-y-4">
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="signup-name" className="text-xs sm:text-sm font-medium text-gray-700">
                      {t("fullName")}
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="signup-name"
                        type="text"
                        value={signupForm.fullName}
                        onChange={(e) => setSignupForm({ ...signupForm, fullName: e.target.value })}
                        disabled={isLoading}
                        className="h-11 sm:h-12 pl-10 pr-4 text-sm sm:text-base bg-white/60 backdrop-blur border-gray-200/80 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-all duration-200 rounded-2xl"
                      />
                    </div>
                    {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
                  </div>

                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="signup-email" className="text-xs sm:text-sm font-medium text-gray-700">
                      {t("email")}
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="email@example.com"
                        value={signupForm.email}
                        onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                        disabled={isLoading}
                        className="h-11 sm:h-12 pl-10 pr-4 text-sm sm:text-base bg-white/60 backdrop-blur border-gray-200/80 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-all duration-200 placeholder:text-gray-400 rounded-2xl"
                      />
                    </div>
                    {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                  </div>

                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="signup-password" className="text-xs sm:text-sm font-medium text-gray-700">
                      {t("password")}
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="signup-password"
                        type="password"
                        value={signupForm.password}
                        onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                        disabled={isLoading}
                        className="h-11 sm:h-12 pl-10 pr-4 text-sm sm:text-base bg-white/60 backdrop-blur border-gray-200/80 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-all duration-200 rounded-2xl"
                      />
                    </div>
                    {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
                  </div>

                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="signup-confirm-password" className="text-xs sm:text-sm font-medium text-gray-700">
                      {t("confirmPassword")}
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="signup-confirm-password"
                        type="password"
                        value={signupForm.confirmPassword}
                        onChange={(e) => setSignupForm({ ...signupForm, confirmPassword: e.target.value })}
                        disabled={isLoading}
                        className="h-11 sm:h-12 pl-10 pr-4 text-sm sm:text-base bg-white/60 backdrop-blur border-gray-200/80 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-all duration-200 rounded-2xl"
                      />
                    </div>
                    {errors.confirmPassword && (
                      <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>
                    )}
                  </div>

                  {/* Gradient Signup Button */}
                  <Button
                    type="submit"
                    className="w-full h-11 sm:h-12 text-sm sm:text-base font-semibold bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 mt-2 rounded-2xl border-0"
                    disabled={isLoading}
                  >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("signup")}
                  </Button>

                  {/* Social Login Divider */}
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200/80"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-white/70 px-3 text-gray-500">
                        {language === "th" ? "หรือสมัครด้วย" : "or sign up with"}
                      </span>
                    </div>
                  </div>

                  {/* Social Login Buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 bg-white/60 backdrop-blur border-gray-200/80 hover:bg-white/80 hover:border-gray-300 transition-all duration-200 rounded-xl text-gray-700 font-medium"
                      onClick={() => toast({
                        title: "Google",
                        description: language === "th" ? "ยังไม่พร้อมใช้งาน" : "Coming soon",
                      })}
                    >
                      <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Google
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 bg-white/60 backdrop-blur border-gray-200/80 hover:bg-white/80 hover:border-gray-300 transition-all duration-200 rounded-xl text-gray-700 font-medium"
                      onClick={() => toast({
                        title: "Microsoft",
                        description: language === "th" ? "ยังไม่พร้อมใช้งาน" : "Coming soon",
                      })}
                    >
                      <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                        <path fill="#F25022" d="M1 1h10v10H1z"/>
                        <path fill="#00A4EF" d="M1 13h10v10H1z"/>
                        <path fill="#7FBA00" d="M13 1h10v10H13z"/>
                        <path fill="#FFB900" d="M13 13h10v10H13z"/>
                      </svg>
                      Microsoft
                    </Button>
                  </div>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        {/* Footer */}
        <p className="text-xs text-gray-400 mt-6 text-center lg:hidden">
          © 2026 ESG Smart Performance v2.0
        </p>
      </div>
    </div>
  );
}
