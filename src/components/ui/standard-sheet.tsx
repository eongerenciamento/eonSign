import * as React from "react";
import { Upload } from "lucide-react";

import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const standardLabelClass = "text-xs font-medium text-muted-foreground";
export const standardInputClass =
  "h-11 rounded-2xl border-0 bg-muted text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0";
export const standardFieldGroupClass = "space-y-1.5";

type Size = "sm" | "md" | "lg";

const sizeWidth: Record<Size, string> = {
  sm: "sm:w-[min(92dvw,28rem)]",
  md: "sm:w-[min(92dvw,36rem)]",
  lg: "sm:w-[min(92dvw,46rem)]",
};

interface StandardSheetAvatar {
  src?: string | null;
  alt?: string;
  fallback: React.ReactNode;
  onUpload?: (file: File) => void;
}

interface StandardSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  description?: string;
  avatar?: StandardSheetAvatar;
  footer?: React.ReactNode;
  size?: Size;
  scrollable?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function StandardSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  description,
  avatar,
  footer,
  size = "sm",
  scrollable = false,
  className,
  children,
}: StandardSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "inset-y-4 right-4 h-auto w-[calc(100dvw-4rem)] max-w-[calc(100dvw-4rem)] overflow-x-hidden rounded-3xl border-0 p-5 pt-[max(1.25rem,env(safe-area-inset-top))] shadow-lg sm:inset-y-4 sm:right-4 sm:max-w-none sm:p-6 sm:pt-6 [&>button]:hidden",
          sizeWidth[size],
          scrollable && "overflow-y-auto",
          className,
        )}
      >
        <SheetHeader className="flex-row items-center justify-between space-y-0 text-left">
          <div className="min-w-0">
            <SheetTitle className="truncate text-sm font-semibold text-foreground">{title}</SheetTitle>
            {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
            {description ? <SheetDescription className="sr-only">{description}</SheetDescription> : null}
          </div>
          {avatar ? (
            <Label className="relative shrink-0 cursor-pointer">
              <Avatar className="h-11 w-11 rounded-full bg-muted text-muted-foreground">
                {avatar.src ? <AvatarImage src={avatar.src} alt={avatar.alt} /> : null}
                <AvatarFallback className="bg-muted text-muted-foreground">{avatar.fallback}</AvatarFallback>
              </Avatar>
              {avatar.onUpload ? (
                <>
                  <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                    <Upload className="h-3.5 w-3.5" />
                  </span>
                  <Input
                    className="hidden"
                    type="file"
                    accept="image/*"
                    onChange={(event) => event.target.files?.[0] && avatar.onUpload?.(event.target.files[0])}
                  />
                </>
              ) : null}
            </Label>
          ) : null}
        </SheetHeader>
        <div className="mt-6 grid gap-4">{children}</div>
        {footer ? <div className="flex items-center justify-end gap-2 pt-2">{footer}</div> : null}
      </SheetContent>
    </Sheet>
  );
}
