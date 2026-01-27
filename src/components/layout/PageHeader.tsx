import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

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
    <div className="relative overflow-hidden rounded-lg bg-sidebar mb-6">
      <div className="relative z-10 flex items-center justify-between px-6 py-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">{title}</h1>
          <nav className="flex items-center gap-1 text-sm">
            {breadcrumbs.map((crumb, index) => (
              <span key={index} className="flex items-center gap-1">
                {index > 0 && (
                  <ChevronRight className="h-4 w-4 text-white/60" />
                )}
                {crumb.href ? (
                  <Link
                    to={crumb.href}
                    className="text-white/80 hover:text-white transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-white/60">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        </div>
        {imageUrl && (
          <div className="hidden md:block">
            <img
              src={imageUrl}
              alt=""
              className="h-24 w-auto object-contain rounded-lg"
            />
          </div>
        )}
      </div>
      {/* Decorative gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-sidebar via-sidebar/90 to-transparent" />
    </div>
  );
}
