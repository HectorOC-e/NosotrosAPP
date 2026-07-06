import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap font-semibold transition disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none",
  {
    variants: {
      variant: {
        // Primary gradient CTA (pink → violet, dark text).
        primary:
          "btn-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink",
        // Translucent secondary.
        ghost: "btn-ghost",
      },
      size: {
        lg: "px-4 py-4 text-[15.5px]",
        md: "px-4 py-3 text-[14px]",
        sm: "px-4 py-[10px] text-[13px]",
      },
    },
    defaultVariants: { variant: "primary", size: "lg" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn("rounded-full", buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
