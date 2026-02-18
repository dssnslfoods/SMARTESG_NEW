import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Globe,
  Leaf,
  Shield,
  BarChart3,
  Users,
  Mail,
  Lock,
  User,
  ArrowRight,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
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
      <div
        className="flex h-screen items-center justify-center"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.6), rgba(0,0,0,0.4), transparent), url('https://images.unsplash.com/photo-1542601906897-ecd7b2ce2bd8?w=1920&q=80')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-xl shadow-lg border border-white/30">
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
      icon: "📊",
      title: language === "th" ? "รายงาน ESG" : "ESG Reporting",
      description:
        language === "th" ? "ติดตามผลการดำเนินงานด้านความยั่งยืน" : "Track sustainability performance metrics",
    },
    {
      icon: "🏛️",
      title: language === "th" ? "การกำกับดูแล" : "Governance",
      description: language === "th" ? "ระบบควบคุมและตรวจสอบภายใน" : "Internal control and audit systems",
    },
    {
      icon: "👥",
      title: language === "th" ? "การมีส่วนร่วม" : "Stakeholder Engagement",
      description: language === "th" ? "เชื่อมต่อกับผู้มีส่วนได้ส่วนเสีย" : "Connect with all stakeholders",
    },
  ];

  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Nature Background with Content Overlay */}
      <div
        className="hidden lg:flex lg:w-[60%] flex-col justify-between relative overflow-hidden"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1542601906897-ecd7b2ce2bd8?w=1920&q=80')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Dark Overlay Gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-transparent" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between h-full p-16">
          {/* Logo Section - Fade in from top */}
          <div className="animate-fadeInUp" style={{ animationDelay: "0.1s", animationFillMode: "both" }}>
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-xl shadow-lg border border-white/20">
                <Leaf className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">ESG Smart Performance</h1>
                <p className="text-sm text-white/70 font-medium">Sustainability Platform v2.5</p>
              </div>
            </div>
          </div>

          {/* Main Heading & Features */}
          <div className="space-y-12">
            {/* Heading - Fade in from left */}
            <div className="animate-fadeInLeft" style={{ animationDelay: "0.2s", animationFillMode: "both" }}>
              <h2 className="text-4xl font-bold leading-tight tracking-tight text-white">
                {language === "th" ? "ขับเคลื่อนองค์กร" : "Driving Your Organization"}
              </h2>
              <h2 className="text-4xl font-bold leading-tight tracking-tight text-white">
                {language === "th" ? "สู่" : "Towards"}
              </h2>
              <h2 className="text-5xl font-bold leading-tight tracking-tight text-emerald-300">
                {language === "th" ? "ความยั่งยืน" : "Sustainability"}
              </h2>
              <p className="mt-6 text-lg text-white/80">
                {language === "th" ? "บริษัท เอ็นเอสแอล ฟู้ดส์ จำกัด (มหาชน)" : "NSL FOODS Public Company Limited"}
              </p>
            </div>

            {/* Feature Cards - Staggered fade in */}
            <div className="space-y-4">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-start gap-4 rounded-2xl bg-white/10 backdrop-blur-md p-4 border border-white/20 transition-all duration-300 hover:bg-white/20 cursor-pointer animate-fadeInLeft"
                  style={{
                    animationDelay: `${0.3 + index * 0.1}s`,
                    animationFillMode: "both",
                  }}
                >
                  <span className="text-2xl">{feature.icon}</span>
                  <div>
                    <h3 className="font-semibold text-base text-white">{feature.title}</h3>
                    <p className="text-sm text-white/70 mt-0.5">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <br></br>
          <p className="text-sm text-white/50">© 2026 ESG Smart Performance | Developed by Arnon Arpaket</p>
        </div>
      </div>

      {/* Right Panel - Frosted Glass Login Form */}
      <div
        className="flex flex-1 flex-col items-center justify-center relative min-h-screen lg:w-[40%]"
        style={{
          background:
            "linear-gradient(to bottom right, rgba(255,255,255,0.9), rgba(255,255,255,0.7), rgba(236,253,245,0.5))",
        }}
      >
        {/* Mobile: Nature Background */}
        <div
          className="lg:hidden absolute inset-0 -z-10"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1542601906897-ecd7b2ce2bd8?w=1920&q=80')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        </div>

        {/* Glass background for desktop */}
        <div className="hidden lg:block absolute inset-0 bg-white/80 backdrop-blur-3xl border-l border-white/50" />

        {/* Language Switcher */}
        <div className="absolute right-4 top-4 sm:right-8 sm:top-8 z-20">
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
            <DropdownMenuContent
              align="end"
              className="min-w-[120px] bg-white/80 backdrop-blur-xl border-white/50 rounded-xl"
            >
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

        {/* Login Form Container */}
        <div
          className="w-full max-w-[400px] px-4 lg:px-0 relative z-10 animate-fadeInRight"
          style={{ animationDelay: "0.3s", animationFillMode: "both" }}
        >
          {/* Mobile Card Wrapper */}
          <div className="lg:bg-transparent lg:shadow-none lg:p-0 bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl p-8 mx-0">
            {/* Header Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 flex items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-2xl shadow-emerald-500/30">
                <Leaf className="h-10 w-10 text-white" />
              </div>
            </div>

            {/* Welcome Text */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-800">{language === "th" ? "ยินดีต้อนรับ" : "Welcome"}</h1>
              <p className="text-gray-500 mt-2">
                {language === "th" ? "เข้าสู่ระบบเพื่อดำเนินการต่อ" : "Sign in to continue"}
              </p>
            </div>

            <Tabs defaultValue="login">
              {/* Tab Switcher */}
              <TabsList className="grid w-full grid-cols-2 h-14 p-1.5 bg-gray-100/80 rounded-2xl mb-8">
                <TabsTrigger
                  value="login"
                  className="text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-emerald-600 transition-all duration-200 rounded-xl text-gray-500 py-3"
                >
                  {t("login")}
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-emerald-600 transition-all duration-200 rounded-xl text-gray-500 py-3"
                >
                  {t("signup")}
                </TabsTrigger>
              </TabsList>

              {/* Login Form */}
              <TabsContent value="login" className="mt-0">
                <form onSubmit={handleLogin} className="space-y-6">
                  {/* Email Field */}
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-sm font-medium text-gray-700">
                      {t("email")}
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="your@email.com"
                        value={loginForm.email}
                        onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                        disabled={isLoading}
                        className="h-14 pl-12 pr-4 text-base bg-white/70 backdrop-blur-sm border-gray-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20 transition-all duration-200 placeholder:text-gray-400 rounded-2xl"
                      />
                    </div>
                    {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                  </div>

                  {/* Password Field */}
                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-sm font-medium text-gray-700">
                      {t("password")}
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                        disabled={isLoading}
                        className="h-14 pl-12 pr-12 text-base bg-white/70 backdrop-blur-sm border-gray-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20 transition-all duration-200 rounded-2xl"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
                  </div>

                  {/* Remember Me & Forgot Password */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="remember"
                        checked={rememberMe}
                        onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                        className="w-5 h-5 rounded-lg border-gray-300 text-emerald-500 focus:ring-emerald-500"
                      />
                      <Label htmlFor="remember" className="text-sm text-gray-600 cursor-pointer">
                        {language === "th" ? "จดจำฉัน" : "Remember me"}
                      </Label>
                    </div>
                    <button
                      type="button"
                      className="text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
                      onClick={() =>
                        toast({
                          title: language === "th" ? "ลืมรหัสผ่าน" : "Forgot Password",
                          description:
                            language === "th" ? "กรุณาติดต่อผู้ดูแลระบบ" : "Please contact your administrator",
                        })
                      }
                    >
                      {language === "th" ? "ลืมรหัสผ่าน?" : "Forgot password?"}
                    </button>
                  </div>

                  {/* Login Button */}
                  <Button
                    type="submit"
                    className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-500 text-white rounded-2xl shadow-xl shadow-emerald-500/30 hover:shadow-2xl hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 border-0 flex items-center justify-center gap-2"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        {language === "th" ? "เข้าสู่ระบบ" : "Sign In"}
                        <ArrowRight className="h-5 w-5 ml-2" />
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* Signup Form */}
              <TabsContent value="signup" className="mt-0">
                <form onSubmit={handleSignup} className="space-y-4">
                  {/* Full Name Field */}
                  <div className="space-y-2">
                    <Label htmlFor="signup-name" className="text-sm font-medium text-gray-700">
                      {t("fullName")}
                    </Label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder={language === "th" ? "ชื่อ-นามสกุล" : "Full Name"}
                        value={signupForm.fullName}
                        onChange={(e) => setSignupForm({ ...signupForm, fullName: e.target.value })}
                        disabled={isLoading}
                        className="h-14 pl-12 pr-4 text-base bg-white/70 backdrop-blur-sm border-gray-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20 transition-all duration-200 placeholder:text-gray-400 rounded-2xl"
                      />
                    </div>
                    {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
                  </div>

                  {/* Email Field */}
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-sm font-medium text-gray-700">
                      {t("email")}
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="your@email.com"
                        value={signupForm.email}
                        onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                        disabled={isLoading}
                        className="h-14 pl-12 pr-4 text-base bg-white/70 backdrop-blur-sm border-gray-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20 transition-all duration-200 placeholder:text-gray-400 rounded-2xl"
                      />
                    </div>
                    {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                  </div>

                  {/* Password Field */}
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-sm font-medium text-gray-700">
                      {t("password")}
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="signup-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={signupForm.password}
                        onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                        disabled={isLoading}
                        className="h-14 pl-12 pr-12 text-base bg-white/70 backdrop-blur-sm border-gray-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20 transition-all duration-200 rounded-2xl"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
                  </div>

                  {/* Confirm Password Field */}
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm-password" className="text-sm font-medium text-gray-700">
                      {t("confirmPassword")}
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="signup-confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={signupForm.confirmPassword}
                        onChange={(e) => setSignupForm({ ...signupForm, confirmPassword: e.target.value })}
                        disabled={isLoading}
                        className="h-14 pl-12 pr-12 text-base bg-white/70 backdrop-blur-sm border-gray-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20 transition-all duration-200 rounded-2xl"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>}
                  </div>

                  {/* Signup Button */}
                  <Button
                    type="submit"
                    className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-500 text-white rounded-2xl shadow-xl shadow-emerald-500/30 hover:shadow-2xl hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 border-0 flex items-center justify-center gap-2 mt-6"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        {language === "th" ? "สมัครสมาชิก" : "Sign Up"}
                        <ArrowRight className="h-5 w-5 ml-2" />
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Mobile Footer */}
        <p className="text-xs text-white/70 lg:text-gray-400 mt-6 text-center lg:hidden relative z-10">
          © 2026 ESG Smart Performance v2.0
        </p>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInLeft {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeInRight {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-fadeInUp { animation: fadeInUp 0.6s ease-out forwards; }
        .animate-fadeInLeft { animation: fadeInLeft 0.6s ease-out forwards; }
        .animate-fadeInRight { animation: fadeInRight 0.6s ease-out forwards; }
      `}</style>
    </div>
  );
}
