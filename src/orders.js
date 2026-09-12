import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { sessionJsonStorage } from "./storage";

const STORAGE_KEY = "om_orders";

export const ORDER_TYPES = [
  { id: "xep-ban-nhan-don", label: "Xếp bản nhận đơn" },
  { id: "kiem-don-voi-mau", label: "Kiểm đơn với mẫu" },
];

export function getOrderTypeLabel(typeId) {
  return ORDER_TYPES.find((type) => type.id === typeId)?.label ?? "—";
}

export function orderKey(code, type) {
  return `${code}::${type}`;
}

export function normalizeOrderCode(raw) {
  return raw.trim().toUpperCase();
}

export function parseOrderLines(text) {
  const valid = [];
  const seen = new Set();

  String(text)
    .split(/\r?\n/)
    .forEach((line) => {
      const code = normalizeOrderCode(line);
      if (!code || seen.has(code)) return;
      seen.add(code);
      valid.push(code);
    });

  return { valid };
}

export function normalizeNote(raw) {
  return String(raw ?? "").trim();
}

export function addOrders(current, codes, employeeId, type, note = "") {
  const existing = new Set(
    current.map((order) => orderKey(order.code, order.type)),
  );
  const added = [];
  const duplicates = [];
  const now = new Date().toISOString();
  const normalizedNote = normalizeNote(note);

  for (const code of codes) {
    const key = orderKey(code, type);
    if (existing.has(key)) {
      duplicates.push(code);
      continue;
    }
    existing.add(key);
    added.push({
      code,
      type,
      employeeId,
      note: normalizedNote,
      createdAt: now,
    });
  }

  return { orders: [...added, ...current], added, duplicates };
}

export function removeOrder(current, code, type) {
  return current.filter(
    (order) => !(order.code === code && order.type === type),
  );
}

export function removeOrdersByKeys(current, keys) {
  const keySet = keys instanceof Set ? keys : new Set(keys);
  return current.filter(
    (order) => !keySet.has(orderKey(order.code, order.type)),
  );
}

function padDay(value) {
  return String(value).padStart(2, "0");
}

function dayKey(date) {
  return `${date.getFullYear()}-${padDay(date.getMonth() + 1)}-${padDay(date.getDate())}`;
}

export function parseLocalDay(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    12,
    0,
    0,
    0,
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeSearchQuery(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/đ/g, "d");
}

export function filterOrdersByQuery(orders, query) {
  const list = Array.isArray(orders) ? orders : [];
  const needle = normalizeSearchQuery(query);
  if (!needle) return list;

  return list.filter((order) => {
    const haystack = [
      order.code,
      order.employeeId,
      order.note,
      getOrderTypeLabel(order.type),
    ]
      .map((value) => normalizeSearchQuery(value))
      .join("\n");
    return haystack.includes(needle);
  });
}

export function filterOrdersByType(orders, typeId) {
  const list = Array.isArray(orders) ? orders : [];
  if (!typeId) return list;
  return list.filter((order) => order.type === typeId);
}

export function filterOrders(orders, { from, to, query, type } = {}) {
  return filterOrdersByType(
    filterOrdersByQuery(filterOrdersByDateRange(orders, from, to), query),
    type,
  );
}

export function hasActiveOrderFilters({ from, to, query, type } = {}) {
  return Boolean(from || to || normalizeSearchQuery(query) || type);
}

export function filterOrdersByDateRange(orders, from, to) {
  const list = Array.isArray(orders) ? orders : [];
  const startDate = parseLocalDay(from);
  const endDate = parseLocalDay(to);
  if (!startDate && !endDate) return list;

  let start = startDate
    ? new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate(),
        0,
        0,
        0,
        0,
      ).getTime()
    : null;
  let end = endDate
    ? new Date(
        endDate.getFullYear(),
        endDate.getMonth(),
        endDate.getDate(),
        23,
        59,
        59,
        999,
      ).getTime()
    : null;
  if (start != null && end != null && start > end) {
    const swap = start;
    start = end;
    end = swap;
  }

  return list.filter((order) => {
    const stamp = order.createdAt || order.updatedAt;
    if (!stamp) return false;
    const time = new Date(stamp).getTime();
    if (Number.isNaN(time)) return false;
    if (start != null && time < start) return false;
    if (end != null && time > end) return false;
    return true;
  });
}

function buildDaySeries(dayCounts, from, to) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  let end = parseLocalDay(to) || today;
  let start = parseLocalDay(from);
  if (!start) {
    start = new Date(end);
    start.setDate(end.getDate() - 6);
  }
  if (start > end) {
    const swap = start;
    start = end;
    end = swap;
  }

  const days = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  const visible = days.length > 31 ? days.slice(days.length - 31) : days;

  return visible.map((date) => {
    const key = dayKey(date);
    return {
      id: key,
      label: `${padDay(date.getDate())}/${padDay(date.getMonth() + 1)}`,
      count: dayCounts.get(key) || 0,
    };
  });
}

export function summarizeOrders(orders, range = {}) {
  const list = Array.isArray(orders) ? orders : [];
  const uniqueCodes = new Set();
  const typeCounts = Object.fromEntries(ORDER_TYPES.map((type) => [type.id, 0]));
  const employeeCounts = new Map();
  const dayCounts = new Map();

  for (const order of list) {
    uniqueCodes.add(order.code);
    if (order.type in typeCounts) {
      typeCounts[order.type] += 1;
    }
    const employeeId = order.employeeId || "—";
    employeeCounts.set(employeeId, (employeeCounts.get(employeeId) || 0) + 1);

    const stamp = order.createdAt || order.updatedAt;
    if (!stamp) continue;
    const date = new Date(stamp);
    if (Number.isNaN(date.getTime())) continue;
    const key = dayKey(date);
    dayCounts.set(key, (dayCounts.get(key) || 0) + 1);
  }

  return {
    total: list.length,
    uniqueCodes: uniqueCodes.size,
    byType: ORDER_TYPES.map((type) => ({
      id: type.id,
      label: type.label,
      count: typeCounts[type.id],
    })),
    byEmployee: [...employeeCounts.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([employeeId, count]) => ({ employeeId, count })),
    byDay: buildDaySeries(dayCounts, range.from, range.to),
  };
}

export function updateOrder(current, originalCode, originalType, patch) {
  const index = current.findIndex(
    (order) => order.code === originalCode && order.type === originalType,
  );
  if (index === -1) {
    return { orders: current, error: "Không tìm thấy đơn hàng." };
  }

  const code = normalizeOrderCode(patch.code ?? "");
  const type = patch.type ?? "";
  const note = normalizeNote(patch.note);

  if (!code) {
    return { orders: current, error: "Nhập mã đơn." };
  }
  if (!ORDER_TYPES.some((item) => item.id === type)) {
    return { orders: current, error: "Chọn công đoạn." };
  }

  const key = orderKey(code, type);
  const duplicate = current.some(
    (order, itemIndex) =>
      itemIndex !== index && orderKey(order.code, order.type) === key,
  );
  if (duplicate) {
    return { orders: current, error: "Mã đơn này đã có với cùng công đoạn." };
  }

  const next = current.map((order, itemIndex) =>
    itemIndex === index
      ? { ...order, code, type, note, updatedAt: new Date().toISOString() }
      : order,
  );
  return { orders: next, error: "" };
}

export function updateOrderSeconds(current, code, type, seconds) {
  const index = current.findIndex(
    (order) => order.code === code && order.type === type,
  );
  if (index === -1) {
    return { orders: current, error: "Không tìm thấy đơn hàng." };
  }
  if (seconds != null && (typeof seconds !== "number" || !Number.isFinite(seconds))) {
    return { orders: current, error: "Nhập số giây hợp lệ." };
  }

  const next = current.map((order, itemIndex) => {
    if (itemIndex !== index) return order;
    if (seconds == null) {
      if (!("seconds" in order)) return order;
      const { seconds: _ignored, ...rest } = order;
      return rest;
    }
    return { ...order, seconds };
  });
  return { orders: next, error: "" };
}

export function updateOrdersSeconds(current, keys, seconds) {
  const keySet = keys instanceof Set ? keys : new Set(keys);
  if (keySet.size === 0) {
    return { orders: current, error: "Chọn ít nhất một mã đơn." };
  }
  if (seconds != null && (typeof seconds !== "number" || !Number.isFinite(seconds))) {
    return { orders: current, error: "Nhập số giây hợp lệ." };
  }

  let found = 0;
  const next = current.map((order) => {
    if (!keySet.has(orderKey(order.code, order.type))) return order;
    found += 1;
    if (seconds == null) {
      if (!("seconds" in order)) return order;
      const { seconds: _ignored, ...rest } = order;
      return rest;
    }
    return { ...order, seconds };
  });
  if (found === 0) {
    return { orders: current, error: "Không tìm thấy đơn hàng." };
  }
  return { orders: next, error: "" };
}

export const ordersAtom = atomWithStorage(STORAGE_KEY, [], sessionJsonStorage, {
  getOnInit: true,
});

export const dateFromAtom = atom("");
export const dateToAtom = atom("");
export const searchQueryAtom = atom("");
export const orderTypeFilterAtom = atom("");

export const filteredOrdersAtom = atom((get) =>
  filterOrders(get(ordersAtom), {
    from: get(dateFromAtom),
    to: get(dateToAtom),
    query: get(searchQueryAtom),
    type: get(orderTypeFilterAtom),
  }),
);

export const hasActiveFiltersAtom = atom((get) =>
  hasActiveOrderFilters({
    from: get(dateFromAtom),
    to: get(dateToAtom),
    query: get(searchQueryAtom),
    type: get(orderTypeFilterAtom),
  }),
);

export const addOrdersAtom = atom(
  null,
  (get, set, codes, employeeId, type, note = "") => {
    const result = addOrders(get(ordersAtom), codes, employeeId, type, note);
    set(ordersAtom, result.orders);
    return result;
  },
);

export const removeOrderAtom = atom(null, (get, set, code, type) => {
  const next = removeOrder(get(ordersAtom), code, type);
  set(ordersAtom, next);
  return next;
});

export const removeOrdersByKeysAtom = atom(null, (get, set, keys) => {
  const next = removeOrdersByKeys(get(ordersAtom), keys);
  set(ordersAtom, next);
  return next;
});

export const updateOrderAtom = atom(
  null,
  (get, set, originalCode, originalType, patch) => {
    const result = updateOrder(
      get(ordersAtom),
      originalCode,
      originalType,
      patch,
    );
    if (!result.error) {
      set(ordersAtom, result.orders);
    }
    return result;
  },
);

export const updateOrderSecondsAtom = atom(
  null,
  (get, set, code, type, seconds) => {
    const result = updateOrderSeconds(get(ordersAtom), code, type, seconds);
    if (!result.error) {
      set(ordersAtom, result.orders);
    }
    return result;
  },
);

export const updateOrdersSecondsAtom = atom(null, (get, set, keys, seconds) => {
  const result = updateOrdersSeconds(get(ordersAtom), keys, seconds);
  if (!result.error) {
    set(ordersAtom, result.orders);
  }
  return result;
});

export const clearOrdersAtom = atom(null, (_get, set) => {
  set(ordersAtom, []);
  return [];
});
