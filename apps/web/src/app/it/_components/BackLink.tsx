import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface BackLinkProps {
  href: string;
  label: string;
}

export function BackLink({ href, label }: BackLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm text-navy/60 hover:text-navy"
    >
      <ArrowLeft size={16} strokeWidth={1.75} />
      {label}
    </Link>
  );
}
