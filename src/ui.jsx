import { forwardRef, useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as MenuPrimitive from "@radix-ui/react-dropdown-menu";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Gauge, Hash, Loader2, Percent, RotateCw, ToggleRight, X } from "lucide-react";

export const cn = (...inputs) => twMerge(clsx(inputs));

const variants = {
  primary: "bg-slate-900 text-white hover:bg-slate-800",
  outline: "border bg-white hover:bg-slate-50",
  ghost: "hover:bg-slate-100",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

const sizes = {
  md: "h-9 px-4",
  sm: "h-8 px-3 text-xs",
  icon: "h-8 w-8",
};

export const buttonClass = (variant = "primary", size = "md") =>
  cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1",
    "disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
    variants[variant],
    sizes[size],
  );

export const Button = forwardRef(
  ({ variant, size, loading, className, children, disabled, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(buttonClass(variant, size), className)}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" />}
      {children}
    </button>
  ),
);

const control =
  "w-full rounded-md border bg-white px-3 text-sm shadow-sm transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70 aria-[invalid=true]:border-red-500";

export const Input = forwardRef(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(control, "h-9", className)} {...props} />
));

export const Textarea = forwardRef(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(control, "min-h-20 py-2", className)} {...props} />
));

export const Select = forwardRef(({ className, ...props }, ref) => (
  <select ref={ref} className={cn(control, "h-9 pr-8", className)} {...props} />
));

export function Field({ label, htmlFor, error, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? <p className="text-xs text-red-600">{error}</p> : hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export const Switch = forwardRef(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1",
      "disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-emerald-600 data-[state=unchecked]:bg-slate-300",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="block h-4 w-4 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-4" />
  </SwitchPrimitive.Root>
));

export function Modal({ open, onOpenChange, title, description, children, className }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/40 p-4">
          <DialogPrimitive.Content
            className={cn("relative w-full max-w-md rounded-lg border bg-white p-6 shadow-xl", className)}
          >
            <DialogPrimitive.Title className="pr-6 text-base font-semibold">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-sm text-slate-500">{description}</DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
            )}
            <div className="mt-4">{children}</div>
            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-60 hover:opacity-100">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export const ModalFooter = ({ children }) => (
  <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{children}</div>
);

export function ConfirmDialog({ confirmText, actionLabel, danger, pending, onConfirm, ...modal }) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!modal.open) setTyped("");
  }, [modal.open]);

  const blocked = !!confirmText && typed !== confirmText;

  return (
    <Modal {...modal}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!blocked) onConfirm();
        }}
      >
        {confirmText && (
          <Field label={`Type ${confirmText} to confirm`} htmlFor="confirm-text">
            <Input
              id="confirm-text"
              autoFocus
              autoComplete="off"
              className="font-mono"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </Field>
        )}
        <ModalFooter>
          <Button variant="outline" onClick={() => modal.onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" variant={danger ? "danger" : "primary"} disabled={blocked} loading={pending}>
            {actionLabel}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

export const Menu = MenuPrimitive.Root;
export const MenuTrigger = MenuPrimitive.Trigger;

export const MenuContent = ({ className, ...props }) => (
  <MenuPrimitive.Portal>
    <MenuPrimitive.Content
      sideOffset={6}
      className={cn("z-50 min-w-40 rounded-md border bg-white p-1 shadow-md", className)}
      {...props}
    />
  </MenuPrimitive.Portal>
);

export const MenuItem = ({ className, danger, ...props }) => (
  <MenuPrimitive.Item
    className={cn(
      "flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-slate-100 data-[disabled]:opacity-50 [&_svg]:size-4",
      danger && "text-red-600",
      className,
    )}
    {...props}
  />
);

export const MenuSeparator = () => <MenuPrimitive.Separator className="-mx-1 my-1 h-px bg-slate-200" />;

export const Skeleton = ({ className }) => <div className={cn("animate-pulse rounded-md bg-slate-100", className)} />;

export const Spinner = () => (
  <div className="grid h-screen place-items-center text-slate-400">
    <Loader2 className="h-5 w-5 animate-spin" />
  </div>
);

export const envStyle = {
  development: {
    dot: "bg-emerald-500",
    rail: "bg-emerald-600",
    soft: "bg-emerald-50 text-emerald-900",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    label: "Dev",
  },
  staging: {
    dot: "bg-amber-500",
    rail: "bg-amber-500",
    soft: "bg-amber-50 text-amber-900",
    badge: "bg-amber-50 text-amber-800 ring-amber-600/30",
    label: "Staging",
  },
  production: {
    dot: "bg-red-600",
    rail: "bg-red-600",
    soft: "bg-red-50 text-red-900",
    badge: "bg-red-50 text-red-700 ring-red-600/20",
    label: "Prod",
  },
};

export const EnvBadge = ({ kind }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
      envStyle[kind].badge,
    )}
  >
    <span className={cn("h-1.5 w-1.5 rounded-full", envStyle[kind].dot)} />
    {envStyle[kind].label}
  </span>
);

const typeMeta = {
  BOOLEAN: { label: "Boolean", icon: ToggleRight },
  NUMBER: { label: "Number", icon: Hash },
  THRESHOLD: { label: "Threshold", icon: Gauge },
  PERCENTAGE: { label: "Rollout %", icon: Percent },
};

export const flagTypeLabel = (type) => typeMeta[type]?.label ?? type;

export function TypeIcon({ type, className }) {
  const Icon = typeMeta[type]?.icon ?? Hash;
  return (
    <span
      title={flagTypeLabel(type)}
      className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-md border bg-white text-slate-500", className)}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}

export const Chip = ({ children, className }) => (
  <span className={cn("inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600", className)}>
    {children}
  </span>
);

export function EmptyState({ icon, title, text, action }) {
  return (
    <div className="rounded-lg border border-dashed px-6 py-14 text-center">
      <div className="mx-auto w-fit text-slate-400 [&_svg]:h-8 [&_svg]:w-8">{icon}</div>
      <h3 className="mt-3 font-medium">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry, retrying }) {
  return (
    <div className="rounded-lg border px-6 py-10 text-center">
      <p className="text-sm text-red-600">{message}</p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onRetry} disabled={retrying}>
        <RotateCw className={retrying ? "animate-spin" : undefined} />
        Retry
      </Button>
    </div>
  );
}

export function PageHeader({ title, badge, actions, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {badge}
        </div>
        {children && <p className="mt-1 text-sm text-slate-500">{children}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function useDebounced(value, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

const dateTime = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const date = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });
const rel = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

export const formatDate = (iso) => date.format(new Date(iso));
export const formatDateTime = (iso) => dateTime.format(new Date(iso));

const units = [
  ["year", 31536000],
  ["month", 2592000],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

export function timeAgo(iso) {
  const secs = (new Date(iso).getTime() - Date.now()) / 1000;
  for (const [unit, size] of units) {
    if (Math.abs(secs) >= size) return rel.format(Math.round(secs / size), unit);
  }
  return "just now";
}

export const actionLabel = (action = "") => action.toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());