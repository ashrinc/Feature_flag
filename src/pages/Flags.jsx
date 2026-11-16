import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { FlagOff, MoreHorizontal, Pencil, Plus, Search, SlidersHorizontal, Trash2, Users } from "lucide-react";
import {
  errorInfo,
  FLAG_TYPES,
  OPERATORS,
  useAudit,
  useEnvConfigs,
  useFeatureMutations,
  useFeatures,
  useGroupRules,
  useGroups,
  useRuleMutations,
  useSaveConfig,
} from "@/api";
import { useScope } from "@/auth";
import {
  actionLabel,
  Button,
  Chip,
  cn,
  ConfirmDialog,
  EmptyState,
  EnvBadge,
  ErrorState,
  Field,
  flagTypeLabel,
  Input,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Modal,
  ModalFooter,
  PageHeader,
  Select,
  Skeleton,
  Switch,
  Textarea,
  timeAgo,
  TypeIcon,
  useDebounced,
} from "@/ui";

const KEY_RE = /^[a-z][a-z0-9_]*$/;
const CONTEXT_RE = /^[A-Za-z_][A-Za-z0-9_.]*$/;
const PAGE_SIZE = 50;

const toKey = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^[^a-z]+|_+$/g, "")
    .slice(0, 64);

const isNumber = (v) => String(v).trim() !== "" && Number.isFinite(Number(v));
const hasSwitch = (type) => type === "BOOLEAN" || type === "PERCENTAGE";

function defaultConfig(type) {
  switch (type) {
    case "NUMBER":
      return { value: 0 };
    case "THRESHOLD":
      return { operator: ">=", threshold: 0, context_key: "" };
    case "PERCENTAGE":
      return { enabled: false, percentage: 0 };
    default:
      return { enabled: false };
  }
}

function toFormValues(type, config) {
  const c = { ...defaultConfig(type), ...config };
  return {
    enabled: !!c.enabled,
    value: String(c.value ?? 0),
    operator: c.operator ?? ">=",
    threshold: String(c.threshold ?? 0),
    context_key: c.context_key ?? "",
    percentage: c.percentage ?? 0,
  };
}

function toConfig(type, v) {
  if (type === "NUMBER") return { value: Number(v.value) };
  if (type === "THRESHOLD") return { operator: v.operator, threshold: Number(v.threshold), context_key: v.context_key.trim() };
  if (type === "PERCENTAGE") return { enabled: v.enabled, percentage: Math.round(v.percentage * 100) / 100 };
  return { enabled: v.enabled };
}

function summary(type, config = {}) {
  switch (type) {
    case "NUMBER":
      return <span className="font-mono">{config.value ?? 0}</span>;
    case "THRESHOLD":
      return (
        <span className="font-mono">
          {config.context_key || "value"} {config.operator ?? ">="} {config.threshold ?? 0}
        </span>
      );
    case "PERCENTAGE":
      return config.enabled ? `${config.percentage ?? 0}% of users` : <span className="text-slate-400">Off</span>;
    default:
      return config.enabled ? "On" : <span className="text-slate-400">Off</span>;
  }
}

function ValueCell({ type, config = {} }) {
  if (type === "BOOLEAN") return <span className="text-slate-400">—</span>;
  if (type !== "PERCENTAGE") return summary(type, config);
  const pct = config.percentage ?? 0;
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn("h-full rounded-full", config.enabled ? "bg-emerald-500" : "bg-slate-300")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn("tabular-nums", !config.enabled && "text-slate-400")}>{pct}%</span>
    </div>
  );
}


function ValueFields({ type, form, idPrefix }) {
  const {
    register,
    control,
    formState: { errors },
  } = form;

  return (
    <div className="space-y-4">
      {hasSwitch(type) && (
        <Controller
          control={control}
          name="enabled"
          render={({ field }) => (
            <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
              <div>
                <div className="text-sm font-medium">Enabled</div>
                <div className="text-xs text-slate-500">
                  {type === "PERCENTAGE" ? "Master switch. When off, the rollout is ignored." : "Turns the feature on or off."}
                </div>
              </div>
              <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Enabled" />
            </div>
          )}
        />
      )}

      {type === "NUMBER" && (
        <Field label="Value" htmlFor={`${idPrefix}-value`} error={errors.value?.message}>
          <Input
            id={`${idPrefix}-value`}
            inputMode="decimal"
            className="font-mono"
            aria-invalid={!!errors.value}
            {...register("value", { validate: (v) => isNumber(v) || "Enter a valid number" })}
          />
        </Field>
      )}

      {type === "THRESHOLD" && (
        <>
          <Field
            label="Context key"
            htmlFor={`${idPrefix}-ctx`}
            error={errors.context_key?.message}
            hint="The value your app sends, e.g. cart_value."
          >
            <Input
              id={`${idPrefix}-ctx`}
              placeholder="cart_value"
              className="font-mono"
              aria-invalid={!!errors.context_key}
              {...register("context_key", {
                validate: (v) => CONTEXT_RE.test(v.trim()) || "Use letters, numbers, _ or . (e.g. cart_value)",
              })}
            />
          </Field>
          <Field label="Rule" htmlFor={`${idPrefix}-threshold`} error={errors.threshold?.message}>
            <div className="flex gap-2">
              <Select className="w-24 font-mono" aria-label="Operator" {...register("operator")}>
                {OPERATORS.map((op) => (
                  <option key={op}>{op}</option>
                ))}
              </Select>
              <Input
                id={`${idPrefix}-threshold`}
                inputMode="decimal"
                className="font-mono"
                aria-invalid={!!errors.threshold}
                {...register("threshold", { validate: (v) => isNumber(v) || "Enter a valid number" })}
              />
            </div>
          </Field>
        </>
      )}

      {type === "PERCENTAGE" && (
        <Controller
          control={control}
          name="percentage"
          render={({ field }) => (
            <Field label="Rollout" htmlFor={`${idPrefix}-pct`} hint="Share of users who get the feature.">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  aria-label="Rollout percentage"
                  className="h-2 flex-1 cursor-pointer accent-slate-900"
                  value={field.value}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                />
                <div className="relative w-20">
                  <Input
                    id={`${idPrefix}-pct`}
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    className="pr-6 font-mono"
                    value={field.value}
                    onChange={(e) => field.onChange(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                  />
                  <span className="pointer-events-none absolute right-2 top-2 text-sm text-slate-400">%</span>
                </div>
              </div>
            </Field>
          )}
        />
      )}
    </div>
  );
}


function RuleEditor({ type, rule, groups, pending, onCancel, onSave }) {
  const form = useForm({
    defaultValues: { group_id: rule?.group_id ?? groups[0]?.id ?? "", ...toFormValues(type, rule?.config) },
  });
    const submit = form.handleSubmit((v) => onSave(v.group_id, toConfig(type, v)));

  return (
    <div className="space-y-4 rounded-md border bg-slate-50 p-4">
      {rule ? (
        <div className="text-sm font-medium">{rule.group_name}</div>
      ) : (
        <Field label="Group" htmlFor="rule-group">
          <Select id="rule-group" {...form.register("group_id", { required: true })}>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <ValueFields type={type} form={form} idPrefix="rule" />
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" loading={pending} onClick={submit}>
          Save rule
        </Button>
      </div>
    </div>
  );
}

function GroupRules({ flag, envId, requestConfirm }) {
  const { data: rules = [], isLoading } = useGroupRules(envId, flag.id);
  const { data: groups = [] } = useGroups();
  const { save, remove } = useRuleMutations(envId, flag.id);
  const [editing, setEditing] = useState(null);

  const available = groups.filter((g) => !rules.some((r) => r.group_id === g.id));
  const fail = (err) => toast.error(errorInfo(err).message);

  const saveRule = (groupId, config) =>
    requestConfirm(() =>
      save.mutate(
        { groupId, config },
        {
          onSuccess: () => {
            toast.success("Group rule saved");
            setEditing(null);
          },
          onError: fail,
        },
      ),
    );

  const removeRule = (rule) =>
    requestConfirm(() =>
      remove.mutate(rule.group_id, {
        onSuccess: () => toast.success(`${rule.group_name} now uses the default value`),
        onError: fail,
      }),
    );

  return (
    <section>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Group rollout</h3>
        {editing === null && available.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setEditing("new")}>
            <Plus />
            Add group rule
          </Button>
        )}
      </div>
      <p className="mb-3 text-xs text-slate-500">Groups with a rule get their own value. Everyone else gets the default above.</p>

      {isLoading ? (
        <Skeleton className="h-12" />
      ) : (
        <div className="space-y-2">
          {rules.map((rule) =>
            editing?.group_id === rule.group_id ? (
              <RuleEditor
                key={rule.group_id}
                type={flag.type}
                rule={rule}
                groups={groups}
                pending={save.isPending}
                onCancel={() => setEditing(null)}
                onSave={saveRule}
              />
            ) : (
              <div key={rule.group_id} className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
                <Users className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="flex-1 font-medium">{rule.group_name}</span>
                <span className="text-slate-600">{summary(flag.type, rule.config)}</span>
                <Button variant="ghost" size="sm" onClick={() => setEditing(rule)} disabled={editing !== null}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600"
                  onClick={() => removeRule(rule)}
                  disabled={editing !== null || remove.isPending}
                >
                  Remove
                </Button>
              </div>
            ),
          )}

          {editing === "new" && (
            <RuleEditor type={flag.type} groups={available} pending={save.isPending} onCancel={() => setEditing(null)} onSave={saveRule} />
          )}

          {!rules.length && editing === null && (
            <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-slate-500">
              {groups.length ? (
                "No group rules yet."
              ) : (
                <>
                  No user groups yet.{" "}
                  <Link to="/groups" className="font-medium text-slate-900 underline">
                    Create one
                  </Link>
                </>
              )}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function History({ envId, featureId }) {
  const { data, isLoading } = useAudit({ environment_id: envId, feature_id: featureId }, 5);
  const entries = data?.pages[0]?.data ?? [];

  if (isLoading) return <Skeleton className="h-12" />;
  if (!entries.length) return <p className="text-xs text-slate-400">No changes in this environment yet.</p>;

  return (
    <ul className="space-y-1.5 text-xs">
      {entries.map((e) => (
        <li key={e.id} className="flex justify-between gap-3">
          <span className="text-slate-600">{actionLabel(e.action)}</span>
          <span className="shrink-0 text-slate-400">{timeAgo(e.created_at)}</span>
        </li>
      ))}
    </ul>
  );
}

function ProdConfirm({ flagKey, open, onCancel, onConfirm }) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(v) => !v && onCancel()}
      title="Change production?"
      description={
        <>
          This updates <span className="font-mono font-medium text-slate-900">{flagKey}</span> for real users right away.
        </>
      }
      confirmText={flagKey}
      actionLabel="Apply to production"
      danger
      onConfirm={onConfirm}
    />
  );
}

function ConfigDialog({ flag, current, onClose, onSave }) {
  const { env, envId, isProd } = useScope();
  const [confirmAction, setConfirmAction] = useState(null);
  const form = useForm({ defaultValues: toFormValues(flag.type, current?.config) });
  const requestConfirm = (action) => (isProd ? setConfirmAction(() => action) : action());

  const submit = form.handleSubmit((v) => requestConfirm(() => onSave(flag, toConfig(flag.type, v), current?.version)));
 
  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      className="max-w-xl"
      title={flag.name}
      description={
        <span className="flex items-center gap-2">
          <span className="font-mono">{flag.key}</span>
          <Chip>{flagTypeLabel(flag.type)}</Chip>
          {env && <EnvBadge kind={env.kind} />}
          {current && <span className="text-xs text-slate-400">v{current.version}</span>}
        </span>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <h3 className="text-sm font-semibold">Default for everyone</h3>
        <ValueFields type={flag.type} form={form} idPrefix="cfg" />
  
        <div className="flex justify-end">
          <Button type="submit" disabled={!form.formState.isDirty}>
            Save default
          </Button>
        </div>
      </form>

      <div className="mt-6 border-t pt-5">
        <GroupRules flag={flag} envId={envId} requestConfirm={requestConfirm} />
      </div>

      <div className="mt-6 border-t pt-4">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Recent changes</div>
        <History envId={envId} featureId={flag.id} />
      </div>

      <ProdConfirm
        flagKey={flag.key}
        open={!!confirmAction}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          const run = confirmAction;
          setConfirmAction(null);
          run();
        }}
      />
    </Modal>
  );
}

function FlagFormDialog({ flag, onClose }) {
  const { create, update } = useFeatureMutations();
  const editing = !!flag;

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, dirtyFields },
  } = useForm({
    defaultValues: {
      key: flag?.key ?? "",
      name: flag?.name ?? "",
      type: flag?.type ?? "BOOLEAN",
      description: flag?.description ?? "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    const name = values.name.trim();
    const description = values.description.trim();
    try {
      if (flag) {
        await update.mutateAsync({ id: flag.id, name, description });
        toast.success("Flag updated");
      } else {
        const created = await create.mutateAsync({ ...values, name, description });
        const envs = created.configurations_created?.join(", ");
        toast.success(`${created.key} created${envs ? ` in ${envs}` : ""}`);
      }
      onClose();
    } catch (err) {
      const { status, message } = errorInfo(err);
      if (status === 409 && !editing) setError("key", { message: "This key is already used" });
      else toast.error(message);
    }
  });

  const nameField = register("name", {
    validate: (v) => !!v.trim() || "Name is required",
    maxLength: { value: 80, message: "Keep it under 80 characters" },
  });

  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title={editing ? "Edit flag" : "New flag"}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="Name" htmlFor="flag-name" error={errors.name?.message}>
          <Input
            id="flag-name"
            autoFocus
            placeholder="New checkout"
            aria-invalid={!!errors.name}
            {...nameField}
            onChange={(e) => {
              nameField.onChange(e);
              if (!editing && !dirtyFields.key) setValue("key", toKey(e.target.value));
            }}
          />
        </Field>

        <Field
          label="Key"
          htmlFor="flag-key"
          error={errors.key?.message}
          hint={editing ? "Keys can't be changed after creation." : "Used in code. Lowercase letters, numbers and underscores."}
        >
          <Input
            id="flag-key"
            className="font-mono"
            placeholder="new_checkout"
            disabled={editing}
            aria-invalid={!!errors.key}
            {...register("key", {
              required: "Key is required",
              maxLength: { value: 64, message: "Keep it under 64 characters" },
              pattern: { value: KEY_RE, message: "Use lowercase letters, numbers and underscores, starting with a letter" },
            })}
          />
        </Field>

        <Field label="Type" htmlFor="flag-type" hint={editing ? "Type can't be changed after creation." : undefined}>
          <Select id="flag-type" disabled={editing} {...register("type")}>
            {FLAG_TYPES.map((t) => (
              <option key={t} value={t}>
                {flagTypeLabel(t)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Description" htmlFor="flag-desc">
          <Textarea id="flag-desc" rows={3} placeholder="What does this flag control?" {...register("description")} />
        </Field>

        <ModalFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending || update.isPending}>
            {editing ? "Save" : "Create flag"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

export default function FlagsPage() {
  const { env, envId, isProd } = useScope();
  const features = useFeatures();
  const configs = useEnvConfigs(envId);
  const saveConfig = useSaveConfig(envId);
  const { remove } = useFeatureMutations();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [shown, setShown] = useState(PAGE_SIZE);
  const [configuring, setConfiguring] = useState(null);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [pending, setPending] = useState(null);

  const query = useDebounced(search.trim().toLowerCase());
  const configMap = useMemo(() => new Map((configs.data ?? []).map((c) => [c.feature_key, c])), [configs.data]);
  const filtered = useMemo(
    () =>
      (features.data ?? []).filter(
        (f) =>
          (!typeFilter || f.type === typeFilter) &&
          (!query || f.key.includes(query) || f.name.toLowerCase().includes(query)),
      ),
    [features.data, typeFilter, query],
  );
  const rows = filtered.slice(0, shown);
  const counts = useMemo(() => {
    const byType = {};
    (features.data ?? []).forEach((f) => {
      byType[f.type] = (byType[f.type] ?? 0) + 1;
    });
    return byType;
  }, [features.data]);

  const commit = ({ flag, config, version }) => {
    setPending(null);
    setConfiguring(null);
    saveConfig.mutate(
      { featureKey: flag.key, config, version },
      {
        onSuccess: () => toast.success(`${flag.key} saved`),
        onError: (err) => {
          const { status, message } = errorInfo(err);
          if (status === 409) toast.warning(`${flag.key} was changed by someone else. Showing the latest value.`);
          else toast.error(message, { action: { label: "Retry", onClick: () => commit({ flag, config, version }) } });
        },
      },
    );
  };

  const toggle = (flag, enabled) => {
    const current = configMap.get(flag.key);
    const next = { flag, config: { ...defaultConfig(flag.type), ...current?.config, enabled }, version: current?.version };
    if (isProd) setPending(next);
    else commit(next);
  };

  const confirmDelete = () => {
    if (!deleting) return;
    const { id, key } = deleting;
    remove.mutate(id, {
      onSuccess: () => {
        toast.success(`${key} deleted`);
        setDeleting(null);
      },
      onError: (err) => toast.error(errorInfo(err).message),
    });
  };

  const loading = features.isLoading || configs.isLoading;
  const error = features.error ?? configs.error;
  const newFlagButton = (
    <Button onClick={() => setCreating(true)}>
      <Plus />
      New flag
    </Button>
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Flags" badge={env && <EnvBadge kind={env.kind} />} actions={newFlagButton}>
        Values below apply to {env?.name} only.
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            type="search"
            placeholder="Search by key or name"
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setShown(PAGE_SIZE);
            }}
          />
        </div>
        <div className="flex flex-wrap gap-1.5" aria-label="Filter by type">
          {["", ...FLAG_TYPES].map((t) => {
            const active = typeFilter === t;
            return (
              <button
                key={t || "all"}
                aria-pressed={active}
                onClick={() => {
                  setTypeFilter(t);
                  setShown(PAGE_SIZE);
                }}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                  active ? "border-slate-800 bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-50",
                )}
              >
                {t ? flagTypeLabel(t) : "All"}
                <span className={cn("tabular-nums", active ? "text-white/70" : "text-slate-400")}>
                  {t ? counts[t] ?? 0 : features.data?.length ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          message={errorInfo(error).message}
          onRetry={() => {
            features.refetch();
            configs.refetch();
          }}
        />
      ) : !filtered.length ? (
        query || typeFilter ? (
          <EmptyState icon={<Search />} title="No matches" text="Try a different search or type." />
        ) : (
          <EmptyState
            icon={<FlagOff />}
            title="No flags yet"
            text="New flags get a default config in Development, Staging and Production."
            action={newFlagButton}
          />
        )
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50/80 text-left text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Flag</th>
                  <th className="px-4 py-2.5">Value</th>
    
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Version</th>
                  <th className="w-10 px-2 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((flag) => {
                  const current = configMap.get(flag.key);
                  return (
                    <tr key={flag.id} className="transition-colors hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <button className="group flex items-center gap-3 text-left" onClick={() => setConfiguring(flag)}>
                          <TypeIcon type={flag.type} />
                          <span>
                            <span className="block font-medium group-hover:underline">{flag.name}</span>
                            <span className="mt-0.5 block font-mono text-xs text-slate-500">{flag.key}</span>
                          </span>
                        </button>
                      </td>
                      <td className="max-w-56 truncate px-4 py-3 text-slate-700">
                        <ValueCell type={flag.type} config={current?.config} />
                      </td>
              
                      <td className="px-4 py-3">
                        {hasSwitch(flag.type) ? (
                          <label className="inline-flex cursor-pointer items-center gap-2">
                            <Switch
                              checked={!!current?.config?.enabled}
                              aria-label={`Toggle ${flag.key}`}
                              onCheckedChange={(enabled) => toggle(flag, enabled)}
                            />
                            <span className={cn("w-6 text-xs", current?.config?.enabled ? "text-emerald-700" : "text-slate-400")}>
                              {current?.config?.enabled ? "On" : "Off"}
                            </span>
                          </label>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{current ? `v${current.version}` : "—"}</td>
                      <td className="px-2 py-3">
                        <Menu modal={false}>
                          <MenuTrigger
                            aria-label={`Actions for ${flag.key}`}
                            className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </MenuTrigger>
                          <MenuContent align="end">
                            <MenuItem onSelect={() => setConfiguring(flag)}>
                              <SlidersHorizontal />
                              Configure
                            </MenuItem>
                            <MenuItem onSelect={() => setEditing(flag)}>
                              <Pencil />
                              Edit details
                            </MenuItem>
                            <MenuSeparator />
                            <MenuItem danger onSelect={() => setDeleting(flag)}>
                              <Trash2 />
                              Delete
                            </MenuItem>
                          </MenuContent>
                        </Menu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {rows.length} of {filtered.length}
            </span>
            {rows.length < filtered.length && (
              <Button variant="outline" size="sm" onClick={() => setShown((n) => n + PAGE_SIZE)}>
                Load more
              </Button>
            )}
          </div>
        </>
      )}

      {configuring && (
        <ConfigDialog
          flag={configuring}
          current={configMap.get(configuring.key)}
          onClose={() => setConfiguring(null)}
          onSave={(flag, config, version) => commit({ flag, config, version })}
        />
      )}

      {creating && <FlagFormDialog onClose={() => setCreating(false)} />}
      {editing && <FlagFormDialog flag={editing} onClose={() => setEditing(null)} />}

      <ProdConfirm
        flagKey={pending?.flag.key}
        open={!!pending}
        onCancel={() => setPending(null)}
        onConfirm={() => pending && commit(pending)}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title="Delete flag?"
        description="It will be archived and removed from every environment. Apps will fall back to their default value."
        confirmText={deleting?.key}
        actionLabel="Delete flag"
        danger
        pending={remove.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}