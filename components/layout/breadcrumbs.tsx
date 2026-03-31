import Link from "next/link";
import { ChevronRight } from "lucide-react";

type BreadcrumbItem = {
  readonly label: string;
  readonly href?: string;
};

type BreadcrumbsProps = {
  readonly items: readonly BreadcrumbItem[];
};

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 ? (
                <ChevronRight
                  className="h-3.5 w-3.5 flex-shrink-0 text-[rgba(22,32,51,0.32)]"
                  aria-hidden="true"
                />
              ) : null}
              {!isLast && item.href ? (
                <Link
                  href={item.href}
                  className="text-sm text-[rgba(22,32,51,0.56)] transition hover:text-[#172033] hover:underline decoration-[rgba(101,122,179,0.3)]"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={
                    isLast
                      ? "text-sm font-medium text-[#172033]"
                      : "text-sm text-[rgba(22,32,51,0.56)]"
                  }
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
