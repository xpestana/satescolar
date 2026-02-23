import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/hooks/useAuth";
import logoBlack from "@/assets/logo-black.svg";
import futuristicBg from "@/assets/futuristic.jpg";
import { toast } from "sonner";

const loginSchema = z.object({
  email: z.string().email("Ingrese un correo electrónico válido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  rememberMe: z.boolean().default(false),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const navigate = useNavigate();
  const { signIn, userRole, user } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (user && userRole) {
      if (userRole === "admin") {
        navigate("/dashboard", { replace: true });
      } else if (userRole === "school") {
        navigate("/school/dashboard", { replace: true });
      } else if (userRole === "representative") {
        navigate("/representative/dashboard", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [user, userRole, navigate]);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      const { error } = await signIn(data.email, data.password);
      if (error) {
        toast.error("Error al iniciar sesión", {
          description: "Credenciales incorrectas. Por favor, verifique su correo y contraseña.",
        });
      } else {
        toast.success("¡Bienvenido!");
        setLoginSuccess(true);
      }
    } catch (error) {
      toast.error("Error inesperado", {
        description: "Ocurrió un error. Por favor, intente de nuevo.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left side - Image */}
      <div className="hidden lg:flex lg:w-3/5 relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${futuristicBg})`,
          }}
        />
        {/* White gradient from right (form side) fading to the left */}
        <div className="absolute inset-0 bg-gradient-to-l from-card via-card/50 to-transparent" />
      </div>

      {/* Right side - Form */}
      <div className="flex w-full lg:w-2/5 flex-col items-center justify-center px-8 py-12 bg-card">
        <div className="w-full max-w-md space-y-8">
          {/* Logo */}
          <div className="flex justify-center">
            <img src={logoBlack} alt="SAT Escolar" className="h-32" />
          </div>

          {/* Welcome text */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Bienvenido a SAT Escolar</h1>
            <p className="text-muted-foreground">Gestiona, organiza y transforma tu institución educativa.</p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-border" />
            <span className="text-sm font-medium text-muted-foreground">Iniciar sesión</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correo electrónico</FormLabel>
                    <FormControl>
                      <Input placeholder="correo@ejemplo.com" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          placeholder="••••••••"
                          type={showPassword ? "text" : "password"}
                          className="pr-10"
                          {...field}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-between">
                <FormField
                  control={form.control}
                  name="rememberMe"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="text-sm font-normal cursor-pointer">Recordarme</FormLabel>
                    </FormItem>
                  )}
                />
                <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                  ¿Olvidó su contraseña?
                </Link>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
