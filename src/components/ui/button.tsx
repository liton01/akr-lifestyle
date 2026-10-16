import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "gold" | "outline" | "outlineLight" | "ghost" | "danger" | "link";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-dark whitespace-nowrap";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-ink text-ivory hover:bg-ink-soft",
  gold: "bg-gold text-ink hover:bg-gold-dark hover:text-white",
  outline: "border border-ink/80 bg-transparent text-ink hover:bg-ink hover:text-ivory",
  outlineLight: "border border-ivory/40 bg-transparent text-ivory hover:bg-ivory hover:text-ink",
  ghost: "bg-transparent text-ink hover:bg-ivory",
  danger: "bg-danger text-white hover:bg-danger/90",
  link: "bg-transparent px-0 text-ink underline decoration-gold decoration-2 underline-offset-4 hover:text-gold-deep",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
  icon: "h-10 w-10",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(base, variants[variant], variant === "link" ? "h-auto" : sizes[size], className);
}

type ButtonProps = ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize };

export function Button({ variant = "primary", size = "md", className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize };

export function ButtonLink({ variant = "primary", size = "md", className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />;
}
