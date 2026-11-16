import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Check, Copy, History, KeyRound } from "lucide-react";
import { errorInfo, useApiKeyMutations, useApiKeys, useAudit, useEnvMutations, useFeatures } from "@/api";
import { useScope } from "@/auth";
import {
  actionLabel,
  Button,
  ConfirmDialog,
  EmptyState,
  EnvBadge,
  ErrorState,
  Field,
  formatDate,
  formatDateTime,
  Input,
  PageHeader,
  Skeleton,
} from "@/ui";

const show = (v) => {
  if (v == null) return "—";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "none";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

function Changes({ entry }) {
  const before = entry.old_value ?? {};
  const after = entry.new_value ?? {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
    (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]),
  );

  if (!keys.length) return <span className="text-slate-400">—</span>;

  return (
    <ul className="space-y-0.5 font-mono text-xs">
      {keys.map((k) => (
        <li key={k}>
          <span className="text-slate-500">{k}:</span>{" "}
          {k in before && <span className="text-red-600 line-through decoration-red-300">{show(before[k])}</span>}
          {k in before && k in after && <span className="text-slate-400"> → </span>}
          {k in after && <span className="text-emerald-700">{show(after[k])}</span>}
        </li>
      ))}
    </ul>
  );
}

export function AuditPage() {
  const { env, envId } = useScope();
  const audit = useAudit({ environment_id: envId });
  const { data: features = [] } = useFeatures();
  const keyById = useMemo(() => new Map(features.map((f) => [f.id, f.key])), [features]);
  const entries = audit.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Audit log" badge={env && <EnvBadge kind={env.kind} />}>
        Every change made in {env?.name}, newest first.
      </PageHeader>

      {audit.isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : audit.error ? (
        <ErrorState message={errorInfo(audit.error).message} onRetry={audit.refetch} retrying={audit.isRefetching} />
      ) : !entries.length ? (
        <EmptyState icon={<History />} title="Nothing here yet" text="Config changes in this environment will show up here." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50 text-left text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">When</th>
                  <th className="px-4 py-2.5">Action</th>
                  <th className="px-4 py-2.5">Flag</th>
                  <th className="px-4 py-2.5">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y align-top">
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{formatDateTime(e.created_at)}</td>
                    <td className="px-4 py-3">{actionLabel(e.action)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{keyById.get(e.feature_id) ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Changes entry={e} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {audit.hasNextPage && (
            <div className="mt-4 text-center">
              <Button variant="outline" size="sm" loading={audit.isFetchingNextPage} onClick={() => audit.fetchNextPage()}>
                Load older
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CopyField({ value }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex gap-2">
      <Input readOnly value={value} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
      <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={copy} aria-label="Copy">
        {copied ? <Check /> : <Copy />}
      </Button>
    </div>
  );
}

function ApiKeys({ env }) {
  const { data: keys = [], isLoading, error, refetch } = useApiKeys(env.id);
  const { create, revoke } = useApiKeyMutations(env.id);
  const [revoking, setRevoking] = useState(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ defaultValues: { name: "" } });

  const onCreate = handleSubmit(({ name }) =>
    create.mutate(
      { name: name.trim(), environment_id: env.id },
      {
        onSuccess: () => {
          reset();
          toast.success("API key created");
        },
        onError: (err) => toast.error(errorInfo(err).message),
      },
    ),
  );

  const onRevoke = () =>
    revoke.mutate(revoking.id, {
      onSuccess: () => {
        setRevoking(null);
        toast.success("API key revoked");
      },
      onError: (err) => toast.error(errorInfo(err).message),
    });

  return (
    <section className="rounded-lg border p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <KeyRound className="h-4 w-4" />
        API keys
      </h2>
      <p className="mt-1 text-sm text-slate-500">Apps use a key to fetch {env.name} configs. Create one per app.</p>

      <form onSubmit={onCreate} noValidate className="mt-4 flex items-start gap-2">
        <div className="flex-1">
          <Input
            placeholder={`${env.name} app`}
            aria-label="Key name"
            aria-invalid={!!errors.name}
            {...register("name", { validate: (v) => !!v.trim() || "Name is required" })}
          />
          {errors.name && <p className="mt-1.5 text-xs text-red-600">{errors.name.message}</p>}
        </div>
        <Button type="submit" loading={create.isPending}>
          Create key
        </Button>
      </form>

      {create.data && create.data.environment_id === env.id && (
        <div className="mt-4 space-y-2 rounded-md border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">Copy this key now. It won't be shown again.</p>
          <CopyField value={create.data.api_key} />
        </div>
      )}

      <div className="mt-4">
        {isLoading ? (
          <Skeleton className="h-10" />
        ) : error ? (
          <ErrorState message={errorInfo(error).message} onRetry={refetch} />
        ) : keys.length ? (
          <ul className="divide-y rounded-md border">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="flex-1 font-medium">{k.name}</span>
                <span className="text-xs text-slate-400">Created {formatDate(k.created_at)}</span>
                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setRevoking(k)}>
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">No API keys for {env.name} yet.</p>
        )}
      </div>

      <ConfirmDialog
        open={!!revoking}
        onOpenChange={(v) => !v && setRevoking(null)}
        title={`Revoke ${revoking?.name ?? "key"}?`}
        description="Apps using this key will stop getting configs immediately."
        actionLabel="Revoke key"
        danger
        pending={revoke.isPending}
        onConfirm={onRevoke}
      />
    </section>
  );
}

export function SettingsPage() {
  const { env } = useScope();
  const navigate = useNavigate();
  const { rename, archive } = useEnvMutations();
  const [archiving, setArchiving] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm({ values: { name: env?.name ?? "" } });

  if (!env) return null;

  const onRename = handleSubmit(({ name }) =>
    rename.mutate(
      { id: env.id, name: name.trim() },
      {
        onSuccess: () => toast.success("Environment renamed"),
        onError: (err) => toast.error(errorInfo(err).message),
      },
    ),
  );

  const onArchive = () =>
    archive.mutate(env.id, {
      onSuccess: () => {
        toast.success(`${env.name} archived`);
        navigate("/", { replace: true });
      },
      onError: (err) => toast.error(errorInfo(err).message),
    });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Settings" badge={<EnvBadge kind={env.kind} />} />

      <section className="rounded-lg border p-5">
        <h2 className="text-sm font-semibold">Environment</h2>
        <form onSubmit={onRename} noValidate className="mt-4 space-y-4">
          <Field label="Name" htmlFor="env-name" error={errors.name?.message}>
            <div className="flex gap-2">
              <Input
                id="env-name"
                aria-invalid={!!errors.name}
                {...register("name", { validate: (v) => !!v.trim() || "Name is required" })}
              />
              <Button type="submit" variant="outline" disabled={!isDirty} loading={rename.isPending}>
                Rename
              </Button>
            </div>
          </Field>
        </form>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex">
            <dt className="w-32 text-slate-500">ID</dt>
            <dd className="font-mono text-xs leading-5">{env.id}</dd>
          </div>
          <div className="flex">
            <dt className="w-32 text-slate-500">Created</dt>
            <dd>{formatDate(env.created_at)}</dd>
          </div>
        </dl>
      </section>

      <ApiKeys env={env} />

      <section className="rounded-lg border border-red-200 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-red-700">Archive environment</h2>
            <p className="mt-1 text-sm text-slate-500">Hides {env.name} from the dashboard. Its data is kept.</p>
          </div>
          <Button variant="danger" onClick={() => setArchiving(true)}>
            Archive
          </Button>
        </div>
      </section>

      <ConfirmDialog
        open={archiving}
        onOpenChange={setArchiving}
        title={`Archive ${env.name}?`}
        description="It will disappear from the environment switcher."
        confirmText={env.name}
        actionLabel="Archive environment"
        danger
        pending={archive.isPending}
        onConfirm={onArchive}
      />
    </div>
  );
}