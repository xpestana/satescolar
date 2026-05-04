import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import headerImage from "@/assets/header-tech.png";
import { getPageDescription } from "@/lib/page-descriptions";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  breadcrumbs: Breadcrumb[];
  imageUrl?: string;
  description?: string;
}

export function PageHeader({ title, breadcrumbs, imageUrl, description }: PageHeaderProps) {
  const finalDescription = description ?? getPageDescription(title);
  return (
    <div className="relative overflow-hidden rounded-xl bg-primary mb-6">
      <div className="relative z-10 flex items-center justify-between gap-4 px-6 py-5">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-white mb-1">{title}</h1>
          {finalDescription && (
            <p className="text-sm text-white/85 mb-2 max-w-2xl leading-relaxed">
              {finalDescription}
            </p>
          )}
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
        <div className="hidden md:block shrink-0">
          <img
            src={imageUrl ?? headerImage}
            alt=""
            className="h-24 w-auto object-contain drop-shadow-lg"
            loading="lazy"
            width={512}
            height={512}
          />
        </div>
      </div>
      {/* Decorative gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/95 to-primary/80" />
    </div>
  );
}
