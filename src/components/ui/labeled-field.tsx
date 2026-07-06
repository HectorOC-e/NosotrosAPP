import * as React from "react";
import { Input } from "@/components/ui/input";

/** A label + input pair, matching the auth/form field style. */
export function LabeledField({
  label,
  className,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] text-ink-secondary">{label}</span>
      <Input className={className} {...props} />
    </label>
  );
}
