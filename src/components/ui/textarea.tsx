import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
