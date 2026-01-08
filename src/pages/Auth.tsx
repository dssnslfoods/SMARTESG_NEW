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
import { Loader2, Globe, Leaf, Shield, BarChart3, Users } from "lucide-react";
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
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <Leaf className="h-8 w-8 text-primary-foreground animate-pulse" />
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
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
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-[55%] flex-col justify-between bg-gradient-to-br from-primary via-primary to-primary/90 p-16 text-primary-foreground relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 h-64 w-64 rounded-full bg-primary-foreground/20 blur-3xl" />
          <div className="absolute bottom-32 right-20 h-80 w-80 rounded-full bg-primary-foreground/10 blur-3xl" />
          <div className="absolute top-1/2 left-1/3 h-48 w-48 rounded-full bg-primary-foreground/15 blur-2xl" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-foreground/20 backdrop-blur-sm shadow-lg ring-1 ring-primary-foreground/10">
              <Leaf className="h-8 w-8 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">ESG Smart Performance</h1>
              <p className="text-sm text-primary-foreground/70 font-medium">Sustainability Platform v1.0</p>
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
            <p className="mt-6 text-lg text-primary-foreground/80 max-w-lg leading-relaxed">
              {language === "th" ? "บริษัท เอ็นเอสแอล ฟู้ดส์ จำกัด (มหาชน)" : "NSL FOODS Public Company Limited"}
            </p>
          </div>

          <div className="space-y-4">
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex items-start gap-4 rounded-2xl bg-primary-foreground/10 p-5 backdrop-blur-sm border border-primary-foreground/10 transition-all duration-300 hover:bg-primary-foreground/15 hover:translate-x-1"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/20 shadow-sm">
                  <feature.icon className="h-6 w-6" />
                </div>
                <div className="pt-1">
                  <h3 className="font-semibold text-base">{feature.title}</h3>
                  <p className="text-sm text-primary-foreground/70 mt-1">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm text-primary-foreground/50 relative z-10">
          © 2026 ESG Smart Performance | Developed by Arnon Arpaket.
          <br />
          All software and design assets are protected. Unauthorized use or reproduction is prohibited.
        </p>
      </div>

      {/* Right Panel - Auth Forms */}
      <div className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 p-8 lg:p-16 relative">
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
        <div className="absolute right-8 top-8">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 bg-background/80 backdrop-blur-sm border-border/50 hover:bg-background hover:border-border transition-all duration-200 shadow-sm"
              >
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{language === "th" ? "ไทย" : "EN"}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[120px]">
              <DropdownMenuItem onClick={() => setLanguage("th")} className="gap-3 cursor-pointer">
                <span>🇹🇭</span>
                <span>ไทย</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLanguage("en")} className="gap-3 cursor-pointer">
                <span>🇺🇸</span>
                <span>English</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mobile Logo */}
        <div className="mb-10 text-center lg:hidden">
          <div className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-xl shadow-primary/20">
            <Leaf className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{t("appName")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {language === "th" ? "ระบบจัดการความยั่งยืน" : "Sustainability Platform"}
          </p>
        </div>

        <Card className="w-full max-w-[420px] border border-border/50 shadow-2xl shadow-black/5 bg-card/95 backdrop-blur-sm relative z-10">
          <Tabs defaultValue="login">
            <CardHeader className="space-y-4 pb-4 pt-8 px-8">
              <div className="text-center space-y-2">
                <CardTitle className="text-2xl font-bold tracking-tight">
                  {language === "th" ? "ยินดีต้อนรับ" : "Welcome"}
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  {language === "th" ? "เข้าสู่ระบบหรือสร้างบัญชีใหม่" : "Sign in or create a new account"}
                </CardDescription>
              </div>
              <TabsList className="grid w-full grid-cols-2 h-11 p-1 bg-muted/50">
                <TabsTrigger
                  value="login"
                  className="text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200"
                >
                  {t("login")}
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200"
                >
                  {t("signup")}
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="pt-2 pb-8 px-8">
              {/* Login Form */}
              <TabsContent value="login" className="mt-0">
                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-sm font-medium text-foreground">
                      {t("email")}
                    </Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="email@example.com"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                      disabled={isLoading}
                      className="h-12 px-4 bg-background border-border/60 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 placeholder:text-muted-foreground/50"
                    />
                    {errors.email && <p className="text-xs text-destructive mt-1.5">{errors.email}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-sm font-medium text-foreground">
                      {t("password")}
                    </Label>
                    <Input
                      id="login-password"
                      type="password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      disabled={isLoading}
                      className="h-12 px-4 bg-background border-border/60 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                    />
                    {errors.password && <p className="text-xs text-destructive mt-1.5">{errors.password}</p>}
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 mt-2"
                    disabled={isLoading}
                  >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("login")}
                  </Button>
                </form>
              </TabsContent>

              {/* Signup Form */}
              <TabsContent value="signup" className="mt-0">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name" className="text-sm font-medium text-foreground">
                      {t("fullName")}
                    </Label>
                    <Input
                      id="signup-name"
                      type="text"
                      value={signupForm.fullName}
                      onChange={(e) => setSignupForm({ ...signupForm, fullName: e.target.value })}
                      disabled={isLoading}
                      className="h-12 px-4 bg-background border-border/60 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                    />
                    {errors.fullName && <p className="text-xs text-destructive mt-1.5">{errors.fullName}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-sm font-medium text-foreground">
                      {t("email")}
                    </Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="email@example.com"
                      value={signupForm.email}
                      onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                      disabled={isLoading}
                      className="h-12 px-4 bg-background border-border/60 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 placeholder:text-muted-foreground/50"
                    />
                    {errors.email && <p className="text-xs text-destructive mt-1.5">{errors.email}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-sm font-medium text-foreground">
                      {t("password")}
                    </Label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={signupForm.password}
                      onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                      disabled={isLoading}
                      className="h-12 px-4 bg-background border-border/60 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                    />
                    {errors.password && <p className="text-xs text-destructive mt-1.5">{errors.password}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm" className="text-sm font-medium text-foreground">
                      {t("confirmPassword")}
                    </Label>
                    <Input
                      id="signup-confirm"
                      type="password"
                      value={signupForm.confirmPassword}
                      onChange={(e) => setSignupForm({ ...signupForm, confirmPassword: e.target.value })}
                      disabled={isLoading}
                      className="h-12 px-4 bg-background border-border/60 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                    />
                    {errors.confirmPassword && (
                      <p className="text-xs text-destructive mt-1.5">{errors.confirmPassword}</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 mt-2"
                    disabled={isLoading}
                  >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("signup")}
                  </Button>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        <p className="mt-10 text-center text-xs text-muted-foreground/70 lg:hidden">
          © 2026 ESG Smart Performance | Developed by Arnon Arpaket.
          <br />
          All software and design assets are protected. Unauthorized use or reproduction is prohibited.
        </p>
      </div>
    </div>
  );
}
