import { AxiosError } from "axios";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
const SEEDED = "2026-11-15T10:00:00Z";

const admin = { id: uuid(), email: "admin@example.com", created_at: SEEDED };
const PASSWORD = "password";

const readCookie = (name) => {
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
};

const setCookie = (name, value, maxAge) => {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Strict`;
};

const environments = ["Web", "Android", "iOS"].flatMap((platform) =>
  [
    ["Development", "development"],
    ["Staging", "staging"],
    ["Production", "production"],
  ].map(([label, type]) => ({ id: uuid(), name: `${platform} ${label}`, type, created_at: SEEDED, archived_at: null })),
);

const features = [
  ["new_checkout", "New Checkout", "BOOLEAN", "Enables the new checkout experience"],
  ["max_cart_value", "Max cart value", "NUMBER", "Upper limit for cart value"],
  ["premium_checkout", "Premium checkout", "THRESHOLD", "Express checkout for big carts"],
  ["new_search", "New search", "PERCENTAGE", "Search backed by the new index"],
].map(([key, name, type, description]) => ({ id: uuid(), key, name, type, description, created_at: SEEDED, archived_at: null }));

const groups = [
  ["Dev Team", "Development team members"],
  ["QA Team", "Quality assurance team"],
  ["Foodstories Tech Team", "Foodstories technical team"],
].map(([name, description]) => ({ id: uuid(), name, description, created_at: SEEDED, archived_at: null }));

const configs = new Map();
const rules = new Map();
const audit = [];
const apiKeys = new Map();

const defaultConfig = (type) =>
  ({
    BOOLEAN: { enabled: false },
    NUMBER: { value: 0 },
    THRESHOLD: { operator: ">=", threshold: 0, context_key: "value" },
    PERCENTAGE: { enabled: false, percentage: 0 },
  })[type];

const dev = environments.find((e) => e.name === "Web Development");
const prod = environments.find((e) => e.name === "Web Production");
const [checkout, cartValue, premium, search] = features;

const configOf = (env, feature) => {
  const id = `${env.id}:${feature.key}`;
  if (!configs.has(id)) configs.set(id, { config: defaultConfig(feature.type), version: 1, updated_at: feature.created_at });
  return configs.get(id);
};

configOf(dev, checkout).config = { enabled: true };
Object.assign(configOf(prod, cartValue), { config: { value: 100 }, version: 2 });
Object.assign(configOf(prod, premium), { config: { operator: ">=", threshold: 500, context_key: "cart_value" }, version: 2 });
Object.assign(configOf(prod, search), {
    config: { enabled: true, percentage: 25 },
  version: 3,
});

const rulesOf = (envId, featureId) => {
  const id = `${envId}:${featureId}`;
  if (!rules.has(id)) rules.set(id, new Map());
  return rules.get(id);
};

rulesOf(dev.id, checkout.id).set(groups[0].id, { config: { enabled: true }, version: 1, updated_at: SEEDED });

const fail = (status, code, message) => {
  throw { status, code, message };
};

const active = (list) => list.filter((x) => !x.archived_at);

const paginate = (list, query) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.max(1, Number(query.limit) || 20);
  return { data: list.slice((page - 1) * limit, page * limit), pagination: { page, limit, total: list.length } };
};

const findEnv = (id) => active(environments).find((e) => e.id === id) ?? fail(404, "NOT_FOUND", "Environment not found");
const findFeature = (id) => active(features).find((f) => f.id === id) ?? fail(404, "NOT_FOUND", "Feature not found");
const findFeatureByKey = (key) => active(features).find((f) => f.key === key) ?? fail(404, "NOT_FOUND", "Feature not found");
const findGroup = (id) => active(groups).find((g) => g.id === id) ?? fail(404, "NOT_FOUND", "User group not found");

function validateConfig(type, config) {
  const ok = config && typeof config === "object";
  const valid =
    ok &&
    {
      BOOLEAN: () => typeof config.enabled === "boolean",
      NUMBER: () => Number.isFinite(config.value),
      THRESHOLD: () =>
        [">=", ">", "<=", "<", "=="].includes(config.operator) &&
        Number.isFinite(config.threshold) &&
        typeof config.context_key === "string" &&
        config.context_key.length > 0,
      PERCENTAGE: () =>
        typeof config.enabled === "boolean" &&
        Number.isFinite(config.percentage) &&
        config.percentage >= 0 &&
        config.percentage <= 100,
    }[type]();
  if (!valid) fail(400, "VALIDATION_ERROR", "Invalid configuration value");
}

const record = (action, envId, featureId, oldValue, newValue) =>
  audit.unshift({ id: uuid(), environment_id: envId, feature_id: featureId, action, old_value: oldValue, new_value: newValue, created_at: now() });

const publicRoutes = [
  [
    "POST",
    /^\/admin\/login$/,
    ({ body }) => {
      if (body.email?.toLowerCase() !== admin.email || body.password !== PASSWORD) {
        fail(401, "INVALID_CREDENTIALS", "Wrong email or password.");
      }
      setCookie("admin_token", `mock-admin-${uuid()}`, 3600);
      setCookie("csrf_token", uuid(), 3600);
      return { success: true, admin: { id: admin.id, email: admin.email } };
    },
  ],
];

const routes = [
  ["GET", /^\/admin\/me$/, () => admin],
  [
    "POST",
    /^\/admin\/logout$/,
    () => {
      setCookie("admin_token", "", 0);
      setCookie("csrf_token", "", 0);
      return { success: true, message: "Logged out successfully" };
    },
  ],

  ["GET", /^\/environments$/, () => ({ data: active(environments).map(({ archived_at, ...e }) => e) })],
  ["GET", /^\/environments\/([^/]+)$/, ({ args: [id] }) => findEnv(id)],
  [
    "PATCH",
    /^\/environments\/([^/]+)$/,
    ({ args: [id], body }) => {
      const env = findEnv(id);
      if (!body.name?.trim()) fail(400, "VALIDATION_ERROR", "Name is required");
      env.name = body.name.trim();
      return { id: env.id, name: env.name, updated: true };
    },
  ],
  [
    "DELETE",
    /^\/environments\/([^/]+)$/,
    ({ args: [id] }) => {
      findEnv(id).archived_at = now();
      return { message: "Environment archived successfully" };
    },
  ],

  [
    "POST",
    /^\/features$/,
    ({ body }) => {
      if (!/^[a-z][a-z0-9_]*$/.test(body.key ?? "")) fail(400, "VALIDATION_ERROR", "Invalid feature key");
      if (!["BOOLEAN", "NUMBER", "THRESHOLD", "PERCENTAGE"].includes(body.type)) fail(400, "VALIDATION_ERROR", "Invalid feature type");
      if (active(features).some((f) => f.key === body.key)) fail(409, "CONFLICT", "A feature with this key already exists");
      const feature = { id: uuid(), key: body.key, name: body.name, type: body.type, description: body.description ?? "", created_at: now(), archived_at: null };
      features.push(feature);
      const envs = active(environments);
      envs.forEach((env) => configOf(env, feature));
      const { archived_at, ...rest } = feature;
      return { ...rest, configurations_created: envs.map((e) => e.name) };
    },
  ],
  [
    "GET",
    /^\/features$/,
    ({ query }) =>
      paginate(
        active(features)
          .filter((f) => !query.type || f.type === query.type)
          .map(({ archived_at, ...f }) => f),
        query,
      ),
  ],
  ["GET", /^\/features\/([^/]+)$/, ({ args: [id] }) => findFeature(id)],
  [
    "PATCH",
    /^\/features\/([^/]+)$/,
    ({ args: [id], body }) => {
      const feature = findFeature(id);
      if (body.name !== undefined) feature.name = body.name;
      if (body.description !== undefined) feature.description = body.description;
      const { archived_at, created_at, ...rest } = feature;
      return rest;
    },
  ],
  [
    "DELETE",
    /^\/features\/([^/]+)$/,
    ({ args: [id] }) => {
      findFeature(id).archived_at = now();
      return { message: "Feature archived successfully" };
    },
  ],

  [
    "GET",
    /^\/environments\/([^/]+)\/configs$/,
    ({ args: [envId], query }) => {
      const env = findEnv(envId);
      const list = active(features).map((f) => {
        const { config, version } = configOf(env, f);
        return { feature_key: f.key, type: f.type, config, version };
      });
      return { environment: env.name, ...paginate(list, query) };
    },
  ],
  [
    "GET",
    /^\/environments\/([^/]+)\/configs\/([^/]+)$/,
    ({ args: [envId, key] }) => {
      const env = findEnv(envId);
      const feature = findFeatureByKey(key);
      const { config, version, updated_at } = configOf(env, feature);
      return { feature_key: key, type: feature.type, config, version, updated_at };
    },
  ],
  [
    "PUT",
    /^\/environments\/([^/]+)\/configs\/([^/]+)$/,
    ({ args: [envId, key], body }) => {
      const env = findEnv(envId);
      const feature = findFeatureByKey(key);
      validateConfig(feature.type, body.config);
      const current = configOf(env, feature);
      if (body.expected_version != null && body.expected_version !== current.version) {
        fail(409, "VERSION_CONFLICT", "Configuration was changed by someone else");
      }
      const oldValue = current.config;
      Object.assign(current, { config: body.config, version: current.version + 1, updated_at: now() });
      record("CONFIG_UPDATED", env.id, feature.id, oldValue, current.config);
      return { feature_key: key, type: feature.type, config: current.config, version: current.version, updated_at: current.updated_at };
    },
  ],
    [
    "GET",
    /^\/api-keys$/,
    ({ query }) => ({
      data: [...apiKeys.values()]
        .filter((k) => !query.environment_id || k.environment_id === query.environment_id)
        .map(({ id, name, environment_id, created_at }) => ({ id, name, environment_id, created_at })),
    }),
  ],

  [
    "POST",
    /^\/api-keys$/,
    ({ body }) => {
      const env = findEnv(body.environment_id);
      if (!body.name?.trim()) fail(400, "VALIDATION_ERROR", "Name is required");
      const key = {
        id: uuid(),
        name: body.name,
        environment_id: env.id,
        environment: env.name,
        api_key: `ff_live_${crypto.randomUUID().replace(/-/g, "")}`,
        created_at: now(),
      };
      apiKeys.set(key.id, key);
      return key;
    },
  ],
  [
    "DELETE",
    /^\/api-keys\/([^/]+)$/,
    ({ args: [id] }) => {
      apiKeys.delete(id);
      return { message: "API key revoked successfully" };
    },
  ],

  [
    "GET",
    /^\/audit-logs$/,
    ({ query }) =>
      paginate(
        audit.filter(
          (a) => (!query.environment_id || a.environment_id === query.environment_id) && (!query.feature_id || a.feature_id === query.feature_id),
        ),
        query,
      ),
  ],
  ["GET", /^\/audit-logs\/([^/]+)$/, ({ args: [id] }) => audit.find((a) => a.id === id) ?? fail(404, "NOT_FOUND", "Audit record not found")],

  [
    "POST",
    /^\/user-groups$/,
    ({ body }) => {
      if (!body.name?.trim()) fail(400, "VALIDATION_ERROR", "Name is required");
      if (active(groups).some((g) => g.name.toLowerCase() === body.name.trim().toLowerCase())) {
        fail(409, "CONFLICT", "A group with this name already exists");
      }
      const group = { id: uuid(), name: body.name.trim(), description: body.description ?? "", created_at: now(), archived_at: null };
      groups.push(group);
      const { archived_at, ...rest } = group;
      return rest;
    },
  ],
  ["GET", /^\/user-groups$/, () => ({ data: active(groups).map(({ id, name, description }) => ({ id, name, description })) })],
  ["GET", /^\/user-groups\/([^/]+)$/, ({ args: [id] }) => findGroup(id)],
  [
    "PATCH",
    /^\/user-groups\/([^/]+)$/,
    ({ args: [id], body }) => {
      const group = findGroup(id);
      if (body.name !== undefined) group.name = body.name;
      if (body.description !== undefined) group.description = body.description;
      return { id: group.id, name: group.name, description: group.description, updated: true };
    },
  ],
  [
    "DELETE",
    /^\/user-groups\/([^/]+)$/,
    ({ args: [id] }) => {
      findGroup(id).archived_at = now();
      return { message: "User group archived successfully" };
    },
  ],

  [
    "GET",
    /^\/environments\/([^/]+)\/features\/([^/]+)\/groups$/,
    ({ args: [envId, featureId] }) => {
      const env = findEnv(envId);
      const feature = findFeature(featureId);
      const list = [...rulesOf(env.id, feature.id).entries()]
        .map(([groupId, rule]) => ({ group: active(groups).find((g) => g.id === groupId), rule }))
        .filter(({ group }) => group)
        .map(({ group, rule }) => ({ group_id: group.id, group_name: group.name, config: rule.config, version: rule.version }));
      return { feature_key: feature.key, environment: env.name, groups: list };
    },
  ],
  [
    "PUT",
    /^\/environments\/([^/]+)\/features\/([^/]+)\/groups\/([^/]+)$/,
    ({ args: [envId, featureId, groupId], body }) => {
      const env = findEnv(envId);
      const feature = findFeature(featureId);
      const group = findGroup(groupId);
      validateConfig(feature.type, body.config);
      const map = rulesOf(env.id, feature.id);
      const current = map.get(group.id);
      const next = { config: body.config, version: (current?.version ?? 0) + 1, updated_at: now() };
      map.set(group.id, next);
      record("GROUP_RULE_UPDATED", env.id, feature.id, current ? { group: group.name, ...current.config } : null, { group: group.name, ...next.config });
      return {
        feature_key: feature.key,
        environment: env.name,
        group: { id: group.id, name: group.name },
        config: next.config,
        version: next.version,
        updated_at: next.updated_at,
      };
    },
  ],
  [
    "DELETE",
    /^\/environments\/([^/]+)\/features\/([^/]+)\/groups\/([^/]+)$/,
    ({ args: [envId, featureId, groupId] }) => {
      const env = findEnv(envId);
      const feature = findFeature(featureId);
      const map = rulesOf(env.id, feature.id);
      const current = map.get(groupId) ?? fail(404, "NOT_FOUND", "Rule not found");
      map.delete(groupId);
      const name = groups.find((g) => g.id === groupId)?.name;
      record("GROUP_RULE_REMOVED", env.id, feature.id, { group: name, ...current.config }, null);
      return { message: "Feature group rollout rule removed successfully" };
    },
  ],
];

const signedIn = () => !!readCookie("admin_token")?.startsWith("mock-admin-");

const csrfValid = (config) => {
  const header = config.headers?.["X-CSRF-Token"] ?? config.headers?.get?.("X-CSRF-Token");
  const cookie = readCookie("csrf_token");
  return !!cookie && header === cookie;
};

export async function mockAdapter(config) {
  await wait(200);

  const method = config.method.toUpperCase();
  const url = (config.baseURL?.includes("/admin") ? "/admin" : "") + config.url.split("?")[0];
  const body = typeof config.data === "string" && config.data ? JSON.parse(config.data) : config.data ?? {};
  const query = config.params ?? {};
  const respond = (status, data) => ({ data, status, statusText: String(status), headers: {}, config, request: {} });

  try {
    for (const [m, pattern, handler] of publicRoutes) {
      const match = m === method && url.match(pattern);
      if (match) return respond(200, handler({ args: match.slice(1), body, query }));
    }

    for (const [m, pattern, handler] of routes) {
      const match = m === method && url.match(pattern);
      if (!match) continue;
      if (!signedIn()) fail(401, "UNAUTHORIZED", "Missing or invalid authentication");
      if (method !== "GET" && !csrfValid(config)) fail(403, "CSRF_INVALID", "Missing or invalid CSRF token");
      return respond(method === "POST" ? 201 : 200, handler({ args: match.slice(1), body, query }));
    }

    fail(404, "NOT_FOUND", `No mock for ${method} ${url}`);
  } catch (err) {
    if (!err?.status) throw err;
    const response = respond(err.status, { error: { code: err.code, message: err.message } });
    throw new AxiosError(err.message, AxiosError.ERR_BAD_RESPONSE, config, null, response);
  }
}