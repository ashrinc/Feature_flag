import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import {
  createBrowserRouter,
  Link,
  Navigate,
  NavLink,
  Outlet,
  RouterProvider,
  useLocation,
  useNavigate,
  useRouteError,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { Flag, History, Settings, TriangleAlert, Users } from "lucide-react";
import { envShortName, errorInfo, http, PLATFORM_LABEL } from "./api";
import { AuthProvider, LoginPage, RequireAuth, UserMenu, useScope } from "./auth";
import { Button, cn, envStyle, ErrorState, Spinner } from "./ui";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: (count, err) => {
        const { status } = errorInfo(err);
        return !(status >= 400 && status < 500) && count < 2;
      },
    },
    mutations: { retry: false },
  },
});

function useEnvNavigation() {
  const { envId } = useScope();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (id) => {
    if (id === envId) return;
    navigate(envId ? pathname.replace(`/env/${envId}`, `/env/${id}`) : `/env/${id}/flags`);
  };
}

function groupByPlatform(envs) {
  const groups = [];
  envs.forEach((env) => {
    const key = env.platform ?? "OTHER";
    let group = groups.find((g) => g.key === key);
    if (!group) groups.push((group = { key, label: PLATFORM_LABEL[key] ?? "Other", envs: [] }));
    group.envs.push(env);
  });
  return groups;
}

function EnvPicker() {
  const { envs, envId } = useScope();
  const go = useEnvNavigation();
  const groups = groupByPlatform(envs);
  const showHeadings = groups.some((g) => g.key !== "OTHER");

  return (
    <div role="radiogroup" aria-label="Environment" className="space-y-4">
      {groups.map((group) => (
        <div key={group.key}>
          {showHeadings && <p className="mb-1 px-3 text-xs font-medium text-slate-500">{group.label}</p>}
          <div className="space-y-0.5">
            {group.envs.map((env) => {
              const active = env.id === envId;
              return (
                <button
                  key={env.id}
                  role="radio"
                  aria-checked={active}
                  aria-label={env.name}
                  onClick={() => go(env.id)}
                  className={cn(
                    "relative flex w-full items-center rounded-md py-1.5 pl-4 pr-2 text-left text-sm text-slate-600 transition-colors hover:bg-white",
                    active && cn("font-medium", envStyle[env.kind].soft),
                  )}
                >
                  <span
                    className={cn(
                      "absolute inset-y-1.5 left-1.5 w-1 rounded-full",
                      envStyle[env.kind].rail,
                      !active && "opacity-40",
                    )}
                  />
                  {envShortName(env)}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function AppShell() {
  const scope = useScope();
  const go = useEnvNavigation();

  if (scope.loading) return <Spinner />;
  if (scope.error) {
    return (
      <div className="mx-auto mt-24 max-w-md">
        <ErrorState message={errorInfo(scope.error).message} onRetry={scope.retry} />
      </div>
    );
  }
  if (scope.notFound) return <Navigate to="/" replace />;

  const envId = scope.envId || (scope.envs.find((e) => e.kind === "development") ?? scope.envs[0])?.id;
  const nav = [
    { to: `/env/${envId}/flags`, label: "Flags", icon: Flag },
    { to: "/groups", label: "User groups", icon: Users },
    { to: `/env/${envId}/audit`, label: "Audit log", icon: History },
    { to: `/env/${envId}/settings`, label: "Settings", icon: Settings },
  ];
  const navClass = ({ isActive }) =>
    cn(
      "flex items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-white hover:text-slate-900",
      isActive && "bg-white font-medium text-slate-900 shadow-sm ring-1 ring-slate-200",
    );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-slate-50 md:flex">
        <Link to="/" className="flex h-16 items-center gap-2.5 px-5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-800 text-white">
            <Flag className="h-4 w-4" />
          </span>
          <span className="font-semibold">Feature Flags</span>
        </Link>

        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <p className="mb-1.5 px-3 text-xs text-slate-400">Environment</p>
          <EnvPicker />

          <p className="mb-1.5 mt-7 px-3 text-xs text-slate-400">Manage</p>
          <nav className="space-y-0.5">
            {nav.map(({ to, label, icon: Icon }) => (
              <NavLink key={label} to={to} className={navClass}>
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="border-t p-3">
          <UserMenu />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className={cn("h-1 shrink-0", scope.env ? envStyle[scope.env.kind].rail : "bg-slate-200")} />

        <header className="flex items-center gap-3 border-b px-4 py-3 md:hidden">
          <Link to="/" className="grid h-8 w-8 place-items-center rounded-lg bg-slate-800 text-white">
            <Flag className="h-4 w-4" />
          </Link>
          <select
            aria-label="Environment"
            className="h-9 flex-1 rounded-md border bg-white px-2 text-sm"
            value={scope.envId}
            onChange={(e) => go(e.target.value)}
          >
            {!scope.envId && <option value="">Choose environment</option>}
                        {groupByPlatform(scope.envs).map((group) => (
              <optgroup key={group.key} label={group.label}>
                {group.envs.map((env) => (
                  <option key={env.id} value={env.id}>
                    {env.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <UserMenu compact />
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b px-3 py-2 md:hidden">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink key={label} to={to} className={navClass}>
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        {scope.isProd && (
          <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-6 py-2 text-sm text-red-800 lg:px-10">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            <span>
              <span className="font-semibold">Production.</span> Changes here reach real users as soon as you save.
            </span>
          </div>
        )}

        <main className="min-w-0 flex-1 px-6 py-8 lg:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function RouteError() {
  const error = useRouteError();
  const chunkFailed = /dynamically imported module|Loading chunk/i.test(error?.message ?? "");

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-semibold">This page didn't load</h1>
        <p className="mt-2 text-sm text-slate-500">
          {chunkFailed
            ? "A newer version of the dashboard was released. Reload to get it."
            : "Something went wrong while showing this page. Reload to try again."}
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button onClick={() => window.location.reload()}>Reload</Button>
          <Button variant="outline" onClick={() => window.location.assign("/")}>
            Go to flags
          </Button>
        </div>
      </div>
    </div>
  );
}

function Home() {
  const { envs } = useScope();
  const first = envs.find((e) => e.kind === "development") ?? envs[0];
  if (!first) return <p className="text-sm text-slate-500">No environments found.</p>;
  return <Navigate to={`/env/${first.id}/flags`} replace />;
}

const page = (load) => {
  const Page = lazy(load);
  return (
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  );
};

const lazyNamed = (load, name) => page(() => load().then((m) => ({ default: m[name] })));

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage />, errorElement: <RouteError /> },
  {
    element: <RequireAuth />,
    errorElement: <RouteError />,
    children: [
      {
        path: "/",
        element: <AppShell />,
        children: [
          { index: true, element: <Home /> },
          { path: "env/:eid/flags", element: page(() => import("./pages/Flags")) },
          { path: "groups", element: page(() => import("./pages/Groups")) },
          { path: "env/:eid/audit", element: lazyNamed(() => import("./pages/Environment"), "AuditPage") },
          { path: "env/:eid/settings", element: lazyNamed(() => import("./pages/Environment"), "SettingsPage") },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

async function start() {
  if (import.meta.env.DEV && import.meta.env.VITE_MOCK_API === "true") {
    const { mockAdapter } = await import("./mock");
    http.defaults.adapter = mockAdapter;
  }

  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
        <Toaster position="bottom-right" richColors closeButton />
      </QueryClientProvider>
    </StrictMode>,
  );
}

start();