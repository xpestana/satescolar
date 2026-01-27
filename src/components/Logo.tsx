import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  variant?: "light" | "dark";
  size?: "sm" | "md" | "lg";
}

export function Logo({ className, variant = "dark", size = "md" }: LogoProps) {
  const sizes = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };

  const textSizes = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-3xl",
  };

  const subtitleSizes = {
    sm: "text-[8px]",
    md: "text-xs",
    lg: "text-sm",
  };

  const textColor = variant === "light" ? "text-white" : "text-primary";
  const subtitleColor = variant === "light" ? "text-sidebar-primary" : "text-sidebar-primary";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Logo Icon */}
      <div className={cn("relative", sizes[size])}>
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          {/* Book base */}
          <path
            d="M8 36C8 36 12 34 24 34C36 34 40 36 40 36V12C40 12 36 10 24 10C12 10 8 12 8 12V36Z"
            className={variant === "light" ? "fill-sidebar-primary" : "fill-primary"}
          />
          {/* Book pages */}
          <path
            d="M24 34V10"
            className="stroke-white"
            strokeWidth="2"
          />
          {/* Antenna/signal */}
          <circle cx="24" cy="6" r="2" className={variant === "light" ? "fill-sidebar-primary" : "fill-primary"} />
          <path
            d="M18 8C18 8 20 4 24 4C28 4 30 8 30 8"
            className={variant === "light" ? "stroke-sidebar-primary" : "stroke-primary"}
            strokeWidth="2"
            fill="none"
          />
          <path
            d="M14 10C14 10 18 2 24 2C30 2 34 10 34 10"
            className={variant === "light" ? "stroke-sidebar-primary" : "stroke-primary"}
            strokeWidth="2"
            fill="none"
          />
          {/* Decorative dots */}
          <circle cx="16" cy="24" r="1.5" className="fill-white opacity-80" />
          <circle cx="20" cy="20" r="1.5" className="fill-white opacity-80" />
          <circle cx="28" cy="20" r="1.5" className="fill-white opacity-80" />
          <circle cx="32" cy="24" r="1.5" className="fill-white opacity-80" />
        </svg>
      </div>
      {/* Text */}
      <div className="flex flex-col">
        <span className={cn("font-bold tracking-wide leading-none", textSizes[size], textColor)}>
          SAT
        </span>
        <span className={cn("tracking-widest uppercase leading-none", subtitleSizes[size], subtitleColor)}>
          Escolar
        </span>
      </div>
    </div>
  );
}
