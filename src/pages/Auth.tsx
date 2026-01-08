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
      description: language === "th" ? "ติดตามผลการดำเนินงานด้านความยั่งยืน" : "Track sustainability performance metrics",
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
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-primary p-12 text-primary-foreground">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-foreground/20 backdrop-blur-sm">
              <Leaf className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">ESG Smart Performance</h1>
              <p className="text-sm text-primary-foreground/80">Sustainability Platform</p>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h2 className="text-3xl font-bold leading-tight">
              {language === "th" 
                ? "ขับเคลื่อนองค์กรสู่\nความยั่งยืน" 
                : "Driving Your Organization\nTowards Sustainability"}
            </h2>
            <p className="mt-4 text-lg text-primary-foreground/80 max-w-md">
              {language === "th"
                ? "แพลตฟอร์มจัดการข้อมูล ESG ระดับองค์กร สำหรับการรายงานและวิเคราะห์ผลการดำเนินงานด้านสิ่งแวดล้อม สังคม และธรรมาภิบาล"
                : "Enterprise ESG data management platform for reporting and analyzing environmental, social, and governance performance."}
            </p>
          </div>

          <div className="space-y-4">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-4 rounded-xl bg-primary-foreground/10 p-4 backdrop-blur-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/20">
                  <feature.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="text-sm text-primary-foreground/70">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm text-primary-foreground/60">
          © 2026 ESG Smart Performance. All rights reserved.
        </p>
      </div>

      {/* Right Panel - Auth Forms */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background p-6 lg:p-12">
        {/* Language Switcher */}
        <div className="absolute right-6 top-6">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Globe className="h-4 w-4" />
                {language === "th" ? "ไทย" : "EN"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setLanguage("th")} className="gap-2">
                🇹🇭 ไทย
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLanguage("en")} className="gap-2">
                🇺🇸 English
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mobile Logo */}
        <div className="mb-8 text-center lg:hidden">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <Leaf className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground">{t("appName")}</h1>
          <p className="text-sm text-muted-foreground">
            {language === "th" ? "ระบบจัดการความยั่งยืน" : "Sustainability Platform"}
          </p>
        </div>

        <Card className="w-full max-w-md border-0 shadow-xl lg:shadow-2xl">
          <Tabs defaultValue="login">
            <CardHeader className="space-y-1 pb-2">
              <CardTitle className="text-2xl font-bold text-center">
                {language === "th" ? "ยินดีต้อนรับ" : "Welcome"}
              </CardTitle>
              <CardDescription className="text-center">
                {language === "th" 
                  ? "เข้าสู่ระบบหรือสร้างบัญชีใหม่" 
                  : "Sign in or create a new account"}
              </CardDescription>
              <TabsList className="grid w-full grid-cols-2 mt-4">
                <TabsTrigger value="login" className="text-sm">
                  {t("login")}
                </TabsTrigger>
                <TabsTrigger value="signup" className="text-sm">
                  {t("signup")}
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="pt-4">
              {/* Login Form */}
              <TabsContent value="login" className="mt-0">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-sm font-medium">
                      {t("email")}
                    </Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="email@example.com"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                      disabled={isLoading}
                      className="h-11"
                    />
                    {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-sm font-medium">
                      {t("password")}
                    </Label>
                    <Input
                      id="login-password"
                      type="password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      disabled={isLoading}
                      className="h-11"
                    />
                    {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                  </div>

                  <Button type="submit" className="w-full h-11 text-base" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("login")}
                  </Button>
                </form>
              </TabsContent>

              {/* Signup Form */}
              <TabsContent value="signup" className="mt-0">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name" className="text-sm font-medium">
                      {t("fullName")}
                    </Label>
                    <Input
                      id="signup-name"
                      type="text"
                      value={signupForm.fullName}
                      onChange={(e) => setSignupForm({ ...signupForm, fullName: e.target.value })}
                      disabled={isLoading}
                      className="h-11"
                    />
                    {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-sm font-medium">
                      {t("email")}
                    </Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="email@example.com"
                      value={signupForm.email}
                      onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                      disabled={isLoading}
                      className="h-11"
                    />
                    {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-sm font-medium">
                      {t("password")}
                    </Label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={signupForm.password}
                      onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                      disabled={isLoading}
                      className="h-11"
                    />
                    {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm" className="text-sm font-medium">
                      {t("confirmPassword")}
                    </Label>
                    <Input
                      id="signup-confirm"
                      type="password"
                      value={signupForm.confirmPassword}
                      onChange={(e) => setSignupForm({ ...signupForm, confirmPassword: e.target.value })}
                      disabled={isLoading}
                      className="h-11"
                    />
                    {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
                  </div>

                  <Button type="submit" className="w-full h-11 text-base" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("signup")}
                  </Button>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        <p className="mt-8 text-center text-xs text-muted-foreground lg:hidden">
          © 2026 ESG Smart Performance. All rights reserved.
        </p>
      </div>
    </div>
  );
}