import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import {
  allowsPdCodes,
  normalizeOrderCode,
  ORDER_TYPES,
  orderKey,
} from "./orders";
import { localJsonStorage } from "./storage";

const STORAGE_KEY = "om_type_seconds";
const CODE_SECONDS_KEY = "om_code_seconds";
export const MAX_SECONDS = 99999;

export function formatSeconds(value) {
  if (value == null || Number.isNaN(value)) return "—";
  return Number(value).toLocaleString("vi-VN");
}

export function parseSecondsInput(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return { value: null, error: "" };
  if (!/^\d+$/.test(text)) {
    return { value: null, error: "Nhập số nguyên không âm." };
  }
  const value = Number(text);
  if (value > MAX_SECONDS) {
    return { value: null, error: `Số giây tối đa ${MAX_SECONDS}.` };
  }
  return { value, error: "" };
}

export function normalizeSecondsMap(raw) {
  const next = {};
  if (!raw || typeof raw !== "object") return next;
  for (const type of ORDER_TYPES) {
    const parsed = parseSecondsInput(raw[type.id]);
    if (parsed.error || parsed.value == null) continue;
    next[type.id] = parsed.value;
  }
  return next;
}

export function parseSecondsDraft(draft) {
  const values = {};
  const errors = {};
  for (const type of ORDER_TYPES) {
    const parsed = parseSecondsInput(draft?.[type.id]);
    if (parsed.error) {
      errors[type.id] = parsed.error;
    } else if (parsed.value != null) {
      values[type.id] = parsed.value;
    }
  }
  return { values, errors };
}

export function getTypeSeconds(settings, typeId) {
  const value = settings?.[typeId];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function codeSecondsKey(code, type) {
  return orderKey(normalizeOrderCode(code), type);
}

export function parseCodeSecondsKey(key) {
  const text = String(key ?? "");
  const sep = text.lastIndexOf("::");
  if (sep <= 0) return null;
  const code = normalizeOrderCode(text.slice(0, sep));
  const type = text.slice(sep + 2);
  if (!code || !allowsPdCodes(type)) return null;
  return { code, type };
}

export function normalizeCodeSecondsMap(raw) {
  const next = {};
  if (!raw || typeof raw !== "object") return next;
  for (const [key, rawValue] of Object.entries(raw)) {
    const parsedKey = parseCodeSecondsKey(key);
    if (!parsedKey) continue;
    const parsed = parseSecondsInput(rawValue);
    if (parsed.error || parsed.value == null) continue;
    next[codeSecondsKey(parsedKey.code, parsedKey.type)] = parsed.value;
  }
  return next;
}

export function getCodeSeconds(settings, code, type) {
  if (!code || !type) return null;
  const value = settings?.[codeSecondsKey(code, type)];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function listCodeSeconds(settings) {
  return Object.entries(settings ?? {})
    .map(([key, seconds]) => {
      const parsed = parseCodeSecondsKey(key);
      if (!parsed || typeof seconds !== "number" || !Number.isFinite(seconds)) {
        return null;
      }
      return { key, ...parsed, seconds };
    })
    .filter(Boolean)
    .sort(
      (left, right) =>
        left.code.localeCompare(right.code, "vi") ||
        left.type.localeCompare(right.type),
    );
}

export function getOrderSeconds(order, typeSettings, codeSettings) {
  if (typeof order?.seconds === "number" && Number.isFinite(order.seconds)) {
    return order.seconds;
  }
  const fromCode = getCodeSeconds(codeSettings, order?.code, order?.type);
  if (fromCode != null) return fromCode;
  return getTypeSeconds(typeSettings, order?.type);
}

export function sumOrderSeconds(orders, typeSettings, codeSettings) {
  const list = Array.isArray(orders) ? orders : [];
  let total = 0;
  let counted = 0;
  for (const order of list) {
    const seconds = getOrderSeconds(order, typeSettings, codeSettings);
    if (seconds == null) continue;
    total += seconds;
    counted += 1;
  }
  return counted === 0 ? null : total;
}

export function sumSecondsByType(orders, typeSettings, codeSettings) {
  const list = Array.isArray(orders) ? orders : [];
  const buckets = Object.fromEntries(
    ORDER_TYPES.map((type) => [type.id, { count: 0, seconds: 0, counted: 0 }]),
  );

  for (const order of list) {
    const bucket = buckets[order.type];
    if (!bucket) continue;
    bucket.count += 1;
    const seconds = getOrderSeconds(order, typeSettings, codeSettings);
    if (seconds == null) continue;
    bucket.seconds += seconds;
    bucket.counted += 1;
  }

  const items = ORDER_TYPES.map((type) => ({
    id: type.id,
    label: type.label,
    count: buckets[type.id].count,
    seconds: buckets[type.id].counted === 0 ? null : buckets[type.id].seconds,
  }));
  const withSeconds = items.filter((item) => item.seconds != null);
  return {
    items,
    totalCount: items.reduce((sum, item) => sum + item.count, 0),
    total: withSeconds.length === 0
      ? null
      : withSeconds.reduce((sum, item) => sum + item.seconds, 0),
  };
}

export const secondsSettingsAtom = atomWithStorage(
  STORAGE_KEY,
  {},
  localJsonStorage,
  { getOnInit: true },
);

export const typeSecondsAtom = atom((get) =>
  normalizeSecondsMap(get(secondsSettingsAtom)),
);

export const saveTypeSecondsAtom = atom(null, (_get, set, draft) => {
  const { values, errors } = parseSecondsDraft(draft);
  if (Object.keys(errors).length) {
    return { error: Object.values(errors)[0], errors, values: null };
  }
  set(secondsSettingsAtom, values);
  return { error: "", errors: {}, values };
});

export const saveOneTypeSecondsAtom = atom(null, (get, set, typeId, raw) => {
  if (!ORDER_TYPES.some((item) => item.id === typeId)) {
    return { error: "Không tìm thấy công đoạn." };
  }
  const parsed = parseSecondsInput(raw);
  if (parsed.error) {
    return { error: parsed.error };
  }
  const current = normalizeSecondsMap(get(secondsSettingsAtom));
  const next = { ...current };
  if (parsed.value == null) {
    delete next[typeId];
  } else {
    next[typeId] = parsed.value;
  }
  set(secondsSettingsAtom, next);
  return { error: "", value: parsed.value };
});

export const codeSecondsSettingsAtom = atomWithStorage(
  CODE_SECONDS_KEY,
  {},
  localJsonStorage,
  { getOnInit: true },
);

export const codeSecondsAtom = atom((get) =>
  normalizeCodeSecondsMap(get(codeSecondsSettingsAtom)),
);

export const saveCodeSecondsAtom = atom(null, (get, set, typeId, codes, raw) => {
  if (!allowsPdCodes(typeId)) {
    return { error: "Công đoạn này không dùng mã PD." };
  }
  const parsed = parseSecondsInput(raw);
  if (parsed.error) {
    return { error: parsed.error };
  }
  if (parsed.value == null) {
    return { error: "Nhập thời gian hoàn thành." };
  }

  const unique = [];
  const seen = new Set();
  for (const item of Array.isArray(codes) ? codes : []) {
    const code = normalizeOrderCode(item);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    unique.push(code);
  }
  if (!unique.length) {
    return { error: "Nhập ít nhất một mã PD." };
  }

  const current = normalizeCodeSecondsMap(get(codeSecondsSettingsAtom));
  const next = { ...current };
  for (const code of unique) {
    next[codeSecondsKey(code, typeId)] = parsed.value;
  }
  set(codeSecondsSettingsAtom, next);
  return { error: "", codes: unique, value: parsed.value };
});

export const saveOneCodeSecondsAtom = atom(null, (get, set, code, typeId, raw) => {
  if (!allowsPdCodes(typeId)) {
    return { error: "Công đoạn này không dùng mã PD." };
  }
  const normalized = normalizeOrderCode(code);
  if (!normalized) {
    return { error: "Nhập mã PD." };
  }
  const parsed = parseSecondsInput(raw);
  if (parsed.error) {
    return { error: parsed.error };
  }
  const current = normalizeCodeSecondsMap(get(codeSecondsSettingsAtom));
  const next = { ...current };
  const key = codeSecondsKey(normalized, typeId);
  if (parsed.value == null) {
    delete next[key];
  } else {
    next[key] = parsed.value;
  }
  set(codeSecondsSettingsAtom, next);
  return { error: "", value: parsed.value };
});
