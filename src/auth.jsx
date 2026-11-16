import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Flag, LogOut } from "lucide-react";
import { toast } from "sonner";
import { authApi, errorInfo, setSessionExpiredHandler, useEnvironments } from "./api";
import { Button, cn, Field, Input, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Spinner } from "./ui";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const qc = useQueryClient();
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("checking");

  const reset = useCallback(() => {
    setUser(null);
    setStatus("signed-out");
    qc.clear();
  }, [qc]);

  useEffect(() => {
    setSessionExpiredHandler(reset);
    let active = true;
    authApi
      .me()
      .then((me) => {
        if (!active) return;
        setUser(me);
        setStatus("signed-in");
      })
      .catch(() => active && setStatus("signed-out"));
    return () => {
      active = false;
    };
  }, [reset]);

  const login = useCallback(async (email, password) => {
    await authApi.login({ email, password });
    setUser(await authApi.me());
    setStatus("signed-in");
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      toast.error("Couldn't sign out on the server. Close the browser to end the session.");
    }
    reset();
  }, [reset]);

  const value = useMemo(() => ({ user, status, login, logout }), [user, status, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "checking") return <Spinner />;
  if (status === "signed-out") return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

export function useScope() {
  const { eid } = useParams();
  const environments = useEnvironments();
  const envs = environments.data ?? [];
  const env = envs.find((e) => e.id === eid);

  return {
    envId: eid ?? "",
    env,
    envs,
    isProd: env?.kind === "production",
    loading: environments.isLoading,
    error: environments.error,
    retry: environments.refetch,
    notFound: !!eid && environments.isSuccess && !env,
  };
}

export function UserMenu({ compact }) {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <Menu>
      <MenuTrigger
        aria-label="Account"
        className={cn(
          "flex items-center gap-2.5 rounded-md text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
          !compact && "w-full px-2 py-1.5 hover:bg-slate-100",
        )}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-800 text-xs font-semibold text-white">
          {user.email[0].toUpperCase()}
        </span>
        {!compact && (
          <span className="min-w-0">
            <span className="block text-sm font-medium">Admin</span>
            <span className="block truncate text-xs text-slate-500">{user.email}</span>
          </span>
        )}
      </MenuTrigger>
      <MenuContent align={compact ? "end" : "start"} side={compact ? "bottom" : "top"} className="w-56">
        <div className="px-2 py-1.5 text-xs text-slate-500">{user.email}</div>
        <MenuSeparator />
        <MenuItem onSelect={logout}>
          <LogOut />
          Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginPage() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { email: "", password: "" } });

  const from = location.state?.from;
  const target = from ? from.pathname + from.search : "/";

  if (status === "signed-in") return <Navigate to={target} replace />;

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setServerError("");
    try {
      await login(email.trim(), password);
      navigate(target, { replace: true });
    } catch (err) {
      const { status, message } = errorInfo(err);
      setServerError(status === 401 ? "Wrong email or password." : message);
    }
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-800 text-white">
            <Flag className="h-4 w-4" />
          </span>
          <div>
            <div className="font-semibold leading-tight">Feature Flags</div>
            <div className="text-xs text-slate-500">FoodStories release control</div>
          </div>
        </div>

        <form onSubmit={onSubmit} noValidate className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="flex h-1" aria-hidden>
            <span className="flex-1 bg-emerald-600" />
            <span className="flex-1 bg-amber-500" />
            <span className="flex-1 bg-red-600" />
          </div>

          <div className="space-y-5 p-6">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
              <p className="mt-1 text-sm text-slate-500">Manage flags across Development, Staging and Production.</p>
            </div>

            {serverError && (
              <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {serverError}
              </div>
            )}

            <Field label="Email" htmlFor="email" error={errors.email?.message}>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                autoFocus
                aria-invalid={!!errors.email}
                {...register("email", {
                  required: "Email is required",
                  pattern: { value: EMAIL_RE, message: "Enter a valid email" },
                })}
              />
            </Field>

            <Field label="Password" htmlFor="password" error={errors.password?.message}>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                {...register("password", { required: "Password is required" })}
              />
            </Field>

            <Button type="submit" className="w-full" loading={isSubmitting}>
              Sign in
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}