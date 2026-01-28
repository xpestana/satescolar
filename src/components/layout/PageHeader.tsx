import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import bookImage from "@/assets/book-2.svg";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  breadcrumbs: Breadcrumb[];
  imageUrl?: string;
}

export function PageHeader({ title, breadcrumbs, imageUrl }: PageHeaderProps) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-primary mb-6">
      <div className="relative z-10 flex items-center justify-between px-6 py-5">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">{title}</h1>
          <nav className="flex items-center gap-1.5 text-sm">
            {breadcrumbs.map((crumb, index) => (
              <span key={index} className="flex items-center gap-1.5">
                {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-white/50" />}
                {crumb.href ? (
                  <Link to={crumb.href} className="text-white/80 hover:text-white transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-white/60">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        </div>
        <div className="hidden md:block">
          <img src={bookImage} alt="" className="h-16 w-32 object-contain" />
        </div>
      </div>
      {/* Decorative gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/95 to-primary/80" />
    </div>
  );
}
