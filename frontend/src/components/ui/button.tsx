import { forwardRef, type ButtonHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "forest" | "ghost" | "soft" }

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ className, variant = "primary", ...props }, ref) {
  return <button ref={ref} className={cn("inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", {
    "bg-accent text-accent-foreground hover:brightness-95": variant === "primary",
    "bg-primary text-primary-foreground hover:brightness-110": variant === "forest",
    "text-foreground hover:bg-muted": variant === "ghost",
    "bg-muted text-foreground hover:opacity-80": variant === "soft",
  }, className)} {...props} />
})
