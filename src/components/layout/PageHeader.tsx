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
    <div className="relative overflow-hidden rounded-xl bg-primary mb-8">
      <div className="relative z-10 flex items-center justify-between px-8 py-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-3">{title}</h1>
          <nav className="flex items-center gap-2 text-sm">
            {breadcrumbs.map((crumb, index) => (
              <span key={index} className="flex items-center gap-2">
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
              className="h-28 w-auto object-contain rounded-lg"
            />
          </div>
        )}
      </div>
      {/* Decorative gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/90 to-transparent" />
    </div>
  );
}
