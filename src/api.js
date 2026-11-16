import axios from "axios";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const FLAG_TYPES = ["BOOLEAN", "NUMBER", "THRESHOLD", "PERCENTAGE"];
export const OPERATORS = [">=", ">", "<=", "<", "=="];


let onSessionExpired = () => {};

export const setSessionExpiredHandler = (fn) => {
  onSessionExpired = fn;
};

const ADMIN_URL = import.meta.env.VITE_ADMIN_API_URL ?? "/api/admin";
const SAFE_METHODS = ["get", "head", "options"];

export const readCookie = (name) => {
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
};

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api/v1",
  timeout: 15000,
  withCredentials: true,
});

http.interceptors.request.use((config) => {
  if (!SAFE_METHODS.includes((config.method ?? "get").toLowerCase())) {
    const csrf = readCookie("csrf_token");
    if (csrf) config.headers["X-CSRF-Token"] = csrf;
  }
  return config;
});

http.interceptors.response.use(undefined, (err) => {
  const isLogin = err.config?.baseURL === ADMIN_URL && err.config?.url === "/login";
  if (err.response?.status === 401 && !isLogin) onSessionExpired();
  throw err;
});

const statusMessages = {
  400: "Some of the values aren't valid.",
  403: "You don't have permission to do that.",
  404: "We couldn't find that.",
  409: "Someone else changed this at the same time.",
  500: "Something went wrong on the server.",
};

export function errorInfo(err) {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status ?? 0;
    const message =
      err.response?.data?.error?.message ??
      statusMessages[status] ??
      (status ? `Request failed (${status})` : "Can't reach the server. Check your connection.");
    return { status, code: err.response?.data?.error?.code, message };
  }
  return { status: 0, message: err?.message || "Something went wrong" };
}

const data = (promise) => promise.then((r) => r.data);

async function fetchAll(url, params = {}) {
  const items = [];
  for (let page = 1; ; page++) {
    const res = await data(http.get(url, { params: { ...params, page, limit: 100 } }));
    items.push(...(res.data ?? []));
    const total = res.pagination?.total;
    if (total == null || items.length >= total || !res.data?.length) return items;
  }
}

export const authApi = {
  login: (body) => data(http.post("/login", body, { baseURL: ADMIN_URL })),
  me: () => data(http.get("/me", { baseURL: ADMIN_URL })),
  logout: () => data(http.post("/logout", null, { baseURL: ADMIN_URL })),
};

const KINDS = ["development", "staging", "production"];
const ENV_ORDER = { development: 0, staging: 1, production: 2 };
const PLATFORM_ORDER = { WEB: 0, ANDROID: 1, IOS: 2 };

export const PLATFORM_LABEL = { WEB: "Web", ANDROID: "Android", IOS: "iOS" };

export function envKind(env) {
  if (KINDS.includes(env.type)) return env.type;
  const n = (env.name ?? "").toLowerCase();
  if (n.includes("prod")) return "production";
  if (n.includes("stag")) return "staging";
  return "development";
}

export function envPlatform(env) {
  const p = (env.platform ?? "").toUpperCase();
  if (p in PLATFORM_ORDER) return p;
  const match = (env.name ?? "").match(/\b(web|android|ios)\b/i);
  return match ? match[1].toUpperCase() : null;
}

export const envShortName = (env) =>
  env.platform ? env.name.replace(/\b(web|android|ios)\b\s*/i, "").trim() || env.name : env.name;

export const useEnvironments = () =>
  useQuery({
    queryKey: ["environments"],
    queryFn: () =>
      fetchAll("/environments").then((list) =>
        list
          .map((e) => ({ ...e, kind: envKind(e), platform: envPlatform(e) }))
          .sort(
            (a, b) =>
              (PLATFORM_ORDER[a.platform] ?? 9) - (PLATFORM_ORDER[b.platform] ?? 9) || ENV_ORDER[a.kind] - ENV_ORDER[b.kind],
          ),
      ),
    staleTime: 5 * 60000,
  });

export function useEnvMutations() {
  const qc = useQueryClient();
  const onSuccess = () => qc.invalidateQueries({ queryKey: ["environments"] });
  return {
    rename: useMutation({ mutationFn: ({ id, name }) => data(http.patch(`/environments/${id}`, { name })), onSuccess }),
    archive: useMutation({ mutationFn: (id) => http.delete(`/environments/${id}`), onSuccess }),
  };
}

export const useFeatures = () =>
  useQuery({ queryKey: ["features"], queryFn: () => fetchAll("/features"), staleTime: 60000 });

export const useEnvConfigs = (envId) =>
  useQuery({
    queryKey: ["configs", envId],
    queryFn: () => fetchAll(`/environments/${envId}/configs`),
    enabled: !!envId,
  });

export function useFeatureMutations() {
  const qc = useQueryClient();
  const refresh = () => ["features", "configs", "audit"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  return {
    create: useMutation({ mutationFn: (body) => data(http.post("/features", body)), onSuccess: refresh }),
    update: useMutation({ mutationFn: ({ id, ...body }) => data(http.patch(`/features/${id}`, body)), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (id) => http.delete(`/features/${id}`), onSuccess: refresh }),
  };
}

export function useSaveConfig(envId) {
  const qc = useQueryClient();
  const key = ["configs", envId];
  const patch = (featureKey, next) =>
    qc.setQueryData(key, (old) => old?.map((c) => (c.feature_key === featureKey ? { ...c, ...next } : c)));

  return useMutation({
    mutationFn: ({ featureKey, config, version }) =>
      data(http.put(`/environments/${envId}/configs/${featureKey}`, { config, expected_version: version })),
    onMutate: async ({ featureKey, config }) => {
      await qc.cancelQueries({ queryKey: key });
      const snapshot = qc.getQueryData(key);
      patch(featureKey, { config });
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => qc.setQueryData(key, ctx?.snapshot),
    onSuccess: (saved) => patch(saved.feature_key, saved),
    onSettled: (_d, err) => {
      if (err) qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

export const useGroups = () =>
  useQuery({ queryKey: ["groups"], queryFn: () => fetchAll("/user-groups"), staleTime: 60000 });

export function useGroupMutations() {
  const qc = useQueryClient();
  const onSuccess = () => {
    qc.invalidateQueries({ queryKey: ["groups"] });
    qc.invalidateQueries({ queryKey: ["rules"] });
  };
  return {
    save: useMutation({
      mutationFn: ({ id, ...body }) =>
        id ? data(http.patch(`/user-groups/${id}`, body)) : data(http.post("/user-groups", body)),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: (id) => http.delete(`/user-groups/${id}`), onSuccess }),
  };
}

export const useGroupRules = (envId, featureId) =>
  useQuery({
    queryKey: ["rules", envId, featureId],
    queryFn: () => data(http.get(`/environments/${envId}/features/${featureId}/groups`)).then((r) => r.groups ?? []),
    enabled: !!envId && !!featureId,
  });

export function useRuleMutations(envId, featureId) {
  const qc = useQueryClient();
  const base = `/environments/${envId}/features/${featureId}/groups`;
  const onSuccess = () => {
    qc.invalidateQueries({ queryKey: ["rules", envId, featureId] });
    qc.invalidateQueries({ queryKey: ["audit"] });
  };
  return {
    save: useMutation({ mutationFn: ({ groupId, config }) => data(http.put(`${base}/${groupId}`, { config })), onSuccess }),
    remove: useMutation({ mutationFn: (groupId) => http.delete(`${base}/${groupId}`), onSuccess }),
  };
}

export const useAudit = (filters, limit = 20) =>
  useInfiniteQuery({
    queryKey: ["audit", filters, limit],
    queryFn: ({ pageParam }) => data(http.get("/audit-logs", { params: { ...filters, page: pageParam, limit } })),
    initialPageParam: 1,
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + p.data.length, 0);
      return loaded < (last.pagination?.total ?? 0) ? all.length + 1 : undefined;
    },
  });

export const useApiKeys = (envId) =>
  useQuery({
    queryKey: ["api-keys", envId],
    queryFn: () => fetchAll("/api-keys", { environment_id: envId }),
    enabled: !!envId,
  });
export function useApiKeyMutations(envId) {
  const qc = useQueryClient();
  const onSuccess = () => qc.invalidateQueries({ queryKey: ["api-keys", envId] });
  return {
    create: useMutation({ mutationFn: (body) => data(http.post("/api-keys", body)), onSuccess }),
    revoke: useMutation({ mutationFn: (id) => http.delete(`/api-keys/${id}`), onSuccess }),
  };
}