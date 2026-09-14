import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { sessionAtom } from "./auth";
import { sessionJsonStorage } from "./storage";

const STORAGE_KEY = "om_orders";

export const RECEIVE_ORDER_TYPE_ID = "xep-ban-nhan-don";
export const PD_ORDER_TYPE_IDS = ["lam-don", "kiem-don"];

export const ORDER_TYPES = [
  { id: RECEIVE_ORDER_TYPE_ID, label: "Xếp bản nhận đơn" },
  { id: "kiem-don-voi-mau", label: "Kiểm đơn với mẫu" },
  {
    id: "phan-hinh-the-mau-tem-chuyen-in",
    label: "Phân hình thể màu, phân số lượng tem chuyển in",
  },
  { id: "luu-thong-so-san-pham", label: "Lưu thông số sản phẩm" },
  { id: "sap-xep-seka", label: "Sắp xếp seka" },
  { id: "lam-don", label: "Làm đơn" },
  { id: "kiem-don", label: "Kiểm đơn" },
  { id: "gui-layout-don-san-xuat", label: "Gửi layout đơn sản xuất" },
  { id: "lam-file-ban-nhua", label: "Làm file bản nhựa" },
  { id: "lam-layout", label: "Làm layout" },
  { id: "lam-don-mau", label: "Làm đơn mẫu" },
  { id: "bu-don", label: "Bù đơn" },
  { id: "ve-cat-hinh-giay", label: "Vẽ, cắt hình giày" },
  { id: "luu-macro", label: "Lưu macro" },
  { id: "upload-hinh-giay", label: "Upload hình giày lên hệ thống" },
  { id: "viet-code", label: "Viết code" },
  { id: "luu-size-doi-chieu", label: "Lưu size đối chiếu" },
  { id: "luu-btw", label: "Lưu BTW" },
  { id: "don-loi", label: "Đơn lỗi" },
];

export function getOrderTypeLabel(typeId) {
  return ORDER_TYPES.find((type) => type.id === typeId)?.label ?? "—";
}

export function allowsPdCodes(typeId) {
  return PD_ORDER_TYPE_IDS.includes(typeId);
}

export function orderKey(code, type) {
  return `${code}::${type}`;
}

export function getOrderKind(orderOrKind) {
  if (orderOrKind && typeof orderOrKind === "object") {
    return orderOrKind.kind === "pd" ? "pd" : "co";
  }
  return orderOrKind === "pd" ? "pd" : "co";
}

export function getOrderKindLabel(orderOrKind) {
  return getOrderKind(orderOrKind) === "pd" ? "PD" : "CO";
}

export function recordKey(order) {
  return `${getOrderKind(order)}::${order.code}::${order.type}`;
}

export function makeRecordKey(code, type, kind) {
  return `${getOrderKind(kind)}::${code}::${type}`;
}

function sameRecord(order, code, type, kind) {
  return (
    order.code === code &&
    order.type === type &&
    getOrderKind(order) === getOrderKind(kind)
  );
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

export function addOrders(
  current,
  codes,
  employeeId,
  type,
  note = "",
  seconds = null,
  kind = "co",
) {
  const codeKind = getOrderKind(kind);
  const existing = new Set(current.map((order) => recordKey(order)));
  const added = [];
  const duplicates = [];
  const now = new Date().toISOString();
  const normalizedNote = normalizeNote(note);
  const hasSeconds = typeof seconds === "number" && Number.isFinite(seconds);

  for (const code of codes) {
    const key = makeRecordKey(code, type, codeKind);
    if (existing.has(key)) {
      duplicates.push(code);
      continue;
    }
    existing.add(key);
    added.push({
      code,
      type,
      kind: codeKind,
      employeeId,
      note: normalizedNote,
      createdAt: now,
      ...(hasSeconds ? { seconds } : {}),
    });
  }

  let next = [...added, ...current];
  if (hasSeconds && duplicates.length) {
    const dupKeys = new Set(
      duplicates.map((code) => makeRecordKey(code, type, codeKind)),
    );
    next = next.map((order) =>
      dupKeys.has(recordKey(order)) ? { ...order, seconds } : order,
    );
  }

  return { orders: next, added, duplicates };
}

export function removeOrder(current, code, type, kind = "co") {
  return current.filter((order) => !sameRecord(order, code, type, kind));
}

export function removeOrdersByKeys(current, keys) {
  const keySet = keys instanceof Set ? keys : new Set(keys);
  return current.filter((order) => !keySet.has(recordKey(order)));
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
      getOrderKind(order) === "pd" ? "ma pd" : "ma co",
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

export function filterOrdersByKind(orders, kind) {
  const list = Array.isArray(orders) ? orders : [];
  if (!kind) return list;
  return list.filter((order) => getOrderKind(order) === kind);
}

export function filterOrdersByEmployee(orders, employeeId) {
  const list = Array.isArray(orders) ? orders : [];
  if (!employeeId) return [];
  return list.filter((order) => order.employeeId === employeeId);
}

export function filterOrders(orders, { from, to, query, type, kind } = {}) {
  return filterOrdersByKind(
    filterOrdersByType(
      filterOrdersByQuery(filterOrdersByDateRange(orders, from, to), query),
      type,
    ),
    kind,
  );
}

export function hasActiveOrderFilters({ from, to, query, type, kind } = {}) {
  return Boolean(from || to || normalizeSearchQuery(query) || type || kind);
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

function emptyTypeCounts() {
  return Object.fromEntries(ORDER_TYPES.map((type) => [type.id, 0]));
}

function buildDaySeries(dayTypeCounts, from, to) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  let end = parseLocalDay(to) || today;
  let start = parseLocalDay(from);
  if (!start) {
    start = new Date(end);
    start.setDate(end.getDate() - 13);
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
    const typeCounts = dayTypeCounts.get(key) || emptyTypeCounts();
    const byType = ORDER_TYPES.map((type) => ({
      id: type.id,
      label: type.label,
      count: typeCounts[type.id] || 0,
    }));
    return {
      id: key,
      label: `${padDay(date.getDate())}/${padDay(date.getMonth() + 1)}`,
      count: byType.reduce((sum, item) => sum + item.count, 0),
      byType,
    };
  });
}

export function summarizeOrders(orders, range = {}) {
  const list = Array.isArray(orders) ? orders : [];
  const uniqueCoCodes = new Set();
  const uniquePdCodes = new Set();
  const typeCounts = Object.fromEntries(ORDER_TYPES.map((type) => [type.id, 0]));
  const employeeStats = new Map();
  const dayTypeCounts = new Map();

  for (const order of list) {
    if (getOrderKind(order) === "pd") uniquePdCodes.add(order.code);
    else uniqueCoCodes.add(order.code);
    if (order.type in typeCounts) {
      typeCounts[order.type] += 1;
    }
    const employeeId = order.employeeId || "—";
    let bucket = employeeStats.get(employeeId);
    if (!bucket) {
      bucket = {
        count: 0,
        codes: new Set(),
        coCodes: new Set(),
        pdCodes: new Set(),
        byType: Object.fromEntries(ORDER_TYPES.map((type) => [type.id, 0])),
      };
      employeeStats.set(employeeId, bucket);
    }
    bucket.count += 1;
    bucket.codes.add(order.code);
    if (getOrderKind(order) === "pd") bucket.pdCodes.add(order.code);
    else bucket.coCodes.add(order.code);
    if (order.type in bucket.byType) {
      bucket.byType[order.type] += 1;
    }

    const stamp = order.createdAt || order.updatedAt;
    if (!stamp) continue;
    const date = new Date(stamp);
    if (Number.isNaN(date.getTime())) continue;
    const key = dayKey(date);
    let dayBucket = dayTypeCounts.get(key);
    if (!dayBucket) {
      dayBucket = emptyTypeCounts();
      dayTypeCounts.set(key, dayBucket);
    }
    if (order.type in dayBucket) {
      dayBucket[order.type] += 1;
    }
  }

  return {
    total: list.length,
    uniqueCodes: uniqueCoCodes.size,
    uniqueCoCodes: uniqueCoCodes.size,
    uniquePdCodes: uniquePdCodes.size,
    byType: ORDER_TYPES.map((type) => ({
      id: type.id,
      label: type.label,
      count: typeCounts[type.id],
    })),
    byEmployee: [...employeeStats.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([employeeId, bucket]) => ({
        employeeId,
        count: bucket.count,
        uniqueCodes: bucket.codes.size,
        uniqueCoCodes: bucket.coCodes.size,
        uniquePdCodes: bucket.pdCodes.size,
        byType: ORDER_TYPES.map((type) => ({
          id: type.id,
          label: type.label,
          count: bucket.byType[type.id],
        })),
      })),
    byDay: buildDaySeries(dayTypeCounts, range.from, range.to),
  };
}

export function updateOrder(current, originalCode, originalType, patch) {
  const kind = getOrderKind(patch.kind);
  const index = current.findIndex((order) =>
    sameRecord(order, originalCode, originalType, kind),
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

  const key = makeRecordKey(code, type, kind);
  const duplicate = current.some(
    (order, itemIndex) => itemIndex !== index && recordKey(order) === key,
  );
  if (duplicate) {
    return {
      orders: current,
      error:
        kind === "pd"
          ? "Mã PD này đã có với cùng công đoạn."
          : "Mã CO này đã có với cùng công đoạn.",
    };
  }

  const next = current.map((order, itemIndex) =>
    itemIndex === index
      ? {
          ...order,
          code,
          type,
          kind,
          note,
          updatedAt: new Date().toISOString(),
        }
      : order,
  );
  return { orders: next, error: "" };
}

export function updateOrderSeconds(current, code, type, seconds, kind = "co") {
  const index = current.findIndex((order) =>
    sameRecord(order, code, type, kind),
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
    if (!keySet.has(recordKey(order))) return order;
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
export const orderKindFilterAtom = atom("");

export const accessibleOrdersAtom = atom((get) => {
  const orders = get(ordersAtom);
  const session = get(sessionAtom);
  if (!session) return [];
  if (session.role === "manager") return orders;
  return filterOrdersByEmployee(orders, session.employeeId);
});

export const filteredOrdersAtom = atom((get) =>
  filterOrders(get(accessibleOrdersAtom), {
    from: get(dateFromAtom),
    to: get(dateToAtom),
    query: get(searchQueryAtom),
    type: get(orderTypeFilterAtom),
    kind: get(orderKindFilterAtom),
  }),
);

export const hasActiveFiltersAtom = atom((get) =>
  hasActiveOrderFilters({
    from: get(dateFromAtom),
    to: get(dateToAtom),
    query: get(searchQueryAtom),
    type: get(orderTypeFilterAtom),
    kind: get(orderKindFilterAtom),
  }),
);

function ownsOrder(session, order) {
  if (!session || !order) return false;
  if (session.role === "manager") return true;
  return order.employeeId === session.employeeId;
}

export const addOrdersAtom = atom(
  null,
  (get, set, codes, employeeId, type, note = "", seconds = null, kind = "co") => {
    const session = get(sessionAtom);
    const actorId = session?.employeeId || employeeId;
    const result = addOrders(
      get(ordersAtom),
      codes,
      actorId,
      type,
      note,
      seconds,
      kind,
    );
    set(ordersAtom, result.orders);
    return result;
  },
);

export const removeOrderAtom = atom(null, (get, set, code, type, kind = "co") => {
  const session = get(sessionAtom);
  const current = get(ordersAtom);
  const order = current.find((item) => sameRecord(item, code, type, kind));
  if (!ownsOrder(session, order)) return current;
  const next = removeOrder(current, code, type, kind);
  set(ordersAtom, next);
  return next;
});

export const removeOrdersByKeysAtom = atom(null, (get, set, keys) => {
  const session = get(sessionAtom);
  const current = get(ordersAtom);
  const allowed =
    session?.role === "manager"
      ? keys
      : [...keys].filter((key) => {
          const order = current.find((item) => recordKey(item) === key);
          return ownsOrder(session, order);
        });
  const next = removeOrdersByKeys(current, allowed);
  set(ordersAtom, next);
  return next;
});

export const updateOrderAtom = atom(
  null,
  (get, set, originalCode, originalType, patch) => {
    const session = get(sessionAtom);
    const current = get(ordersAtom);
    const existing = current.find((item) =>
      sameRecord(item, originalCode, originalType, patch?.kind),
    );
    if (!ownsOrder(session, existing)) {
      return { orders: current, error: "Không thể sửa đơn của người khác." };
    }
    const result = updateOrder(current, originalCode, originalType, patch);
    if (!result.error) {
      set(ordersAtom, result.orders);
    }
    return result;
  },
);

export const updateOrderSecondsAtom = atom(
  null,
  (get, set, code, type, seconds, kind = "co") => {
    const result = updateOrderSeconds(
      get(ordersAtom),
      code,
      type,
      seconds,
      kind,
    );
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

export const clearOrdersAtom = atom(null, (get, set) => {
  const session = get(sessionAtom);
  const current = get(ordersAtom);
  if (!session) return current;
  if (session.role === "manager") {
    set(ordersAtom, []);
    return [];
  }
  const next = current.filter(
    (order) => order.employeeId !== session.employeeId,
  );
  set(ordersAtom, next);
  return next;
});
