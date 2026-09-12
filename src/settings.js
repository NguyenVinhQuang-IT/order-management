import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { ORDER_TYPES } from "./orders";
import { localJsonStorage } from "./storage";

const STORAGE_KEY = "om_type_seconds";
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

export function getOrderSeconds(order, typeSettings) {
  if (typeof order?.seconds === "number" && Number.isFinite(order.seconds)) {
    return order.seconds;
  }
  return getTypeSeconds(typeSettings, order?.type);
}

export function sumOrderSeconds(orders, settings) {
  const list = Array.isArray(orders) ? orders : [];
  let total = 0;
  let counted = 0;
  for (const order of list) {
    const seconds = getOrderSeconds(order, settings);
    if (seconds == null) continue;
    total += seconds;
    counted += 1;
  }
  return counted === 0 ? null : total;
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
