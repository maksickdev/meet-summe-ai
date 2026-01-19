import * as React from "react"
import { cn } from "../../lib/utils"

const Slider = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    type="range"
    ref={ref}
    className={cn(
      "w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-700 accent-zinc-900 dark:accent-zinc-50",
      className
    )}
    {...props}
  />
))
Slider.displayName = "Slider"

export { Slider }
