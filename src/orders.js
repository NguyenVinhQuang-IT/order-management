import { atom } from "jotai";
import { api, mapOrder } from "./api";
import { sameEmployeeId, sessionAtom } from "./auth";

export const MAX_ORDERS_PER_ENTRY = 50;
export const ORDERS_PAGE_SIZE = 50;

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
  if (codes.length > MAX_ORDERS_PER_ENTRY) {
    return {
      orders: current,
      added: [],
      duplicates: [],
      error: `Mỗi lần nhập tối đa ${MAX_ORDERS_PER_ENTRY} đơn.`,
    };
  }

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
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .normalize("NFKC")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/đ/g, "d")
    .trim()
    .toLowerCase();
}

function compactSearchToken(raw) {
  return normalizeSearchQuery(raw).replace(/[^a-z0-9]+/g, "");
}

function stripSearchQuotes(raw) {
  return String(raw ?? "").replace(/^[\s"'“”‘’`]+|[\s"'“”‘’`]+$/g, "");
}

export function parseSearchLines(raw) {
  const tokens = [];
  const seen = new Set();
  const chunks = String(raw ?? "").split(/[\r\n,;]+/);

  for (const chunk of chunks) {
    const text = stripSearchQuotes(
      String(chunk ?? "").replace(/[\u200B-\u200D\uFEFF]/g, ""),
    ).trim();
    if (!text) continue;

    const words = text.split(/\s+/).filter(Boolean);
    const asCodes =
      words.length > 1 &&
      words.every((word) => /\d/.test(word) && word.replace(/[^a-z0-9]/gi, "").length >= 3);
    const pieces = asCodes ? words : [text];

    for (const piece of pieces) {
      const needle = normalizeSearchQuery(stripSearchQuotes(piece));
      if (!needle || seen.has(needle)) continue;
      seen.add(needle);
      tokens.push(needle);
    }
  }

  return tokens;
}

function orderSearchFields(order) {
  const values = [
    order.code,
    order.employeeId,
    order.note,
    getOrderTypeLabel(order.type),
    getOrderKind(order) === "pd" ? "ma pd" : "ma co",
  ].map((value) => normalizeSearchQuery(value));
  return {
    code: normalizeSearchQuery(order.code),
    compactCode: compactSearchToken(order.code),
    fields: values,
  };
}

function needleMatchesOrder(needle, fields) {
  if (!needle) return false;
  if (fields.code === needle) return "exact";
  const compact = compactSearchToken(needle);
  if (compact && fields.compactCode === compact) return "exact";
  if (fields.fields.some((field) => field.includes(needle))) return "fuzzy";
  if (compact.length >= 3 && fields.compactCode.includes(compact)) return "fuzzy";
  return null;
}

export function filterOrdersByQuery(orders, query) {
  const list = Array.isArray(orders) ? orders : [];
  const needles = parseSearchLines(query);
  if (!needles.length) return list;

  const scored = [];
  for (const order of list) {
    const fields = orderSearchFields(order);
    let rank = Infinity;
    for (let index = 0; index < needles.length; index += 1) {
      const match = needleMatchesOrder(needles[index], fields);
      if (!match) continue;
      const next = match === "exact" ? index : index + needles.length;
      if (next < rank) rank = next;
    }
    if (rank !== Infinity) scored.push({ order, rank });
  }

  scored.sort((left, right) => left.rank - right.rank);
  return scored.map((item) => item.order);
}

export function unmatchedSearchCodes(orders, query) {
  const needles = parseSearchLines(query);
  if (needles.length < 2) return [];
  const list = Array.isArray(orders) ? orders : [];
  const catalog = list.map((order) => orderSearchFields(order));
  return needles.filter((needle) => {
    if (!/\d/.test(needle)) return false;
    return !catalog.some((fields) => needleMatchesOrder(needle, fields));
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
  return list.filter((order) => sameEmployeeId(order.employeeId, employeeId));
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
  return Boolean(from || to || parseSearchLines(query).length || type || kind);
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

function isoStamp(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function localRangeParams(from, to) {
  const params = {};
  const start = parseLocalDay(from);
  const end = parseLocalDay(to);
  if (start) {
    params.from = isoStamp(
      new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0),
    );
  }
  if (end) {
    params.to = isoStamp(
      new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1, 0, 0, 0, 0),
    );
  }
  return params;
}

export function buildOrderListQuery(filters = {}) {
  const query = {
    page: (filters.page ?? 0) + 1,
    ...localRangeParams(filters.from, filters.to),
  };
  if (filters.q) query.q = filters.q;
  if (filters.type) query.type = filters.type;
  if (filters.kind) query.kind = filters.kind;
  if (filters.empId) query.emp_id = filters.empId;
  return query;
}

export function buildStatsQuery(filters = {}, extra = {}) {
  return {
    tz_offset: new Date().getTimezoneOffset(),
    ...localRangeParams(filters.from, filters.to),
    ...(filters.q ? { q: filters.q } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.kind ? { kind: filters.kind } : {}),
    ...extra,
  };
}

function mapStatType(item) {
  return {
    id: item.id,
    label: item.label,
    count: item.count || 0,
    seconds: typeof item.seconds === "number" ? item.seconds : null,
  };
}

export function mapServerStats(data) {
  return {
    total: data?.total || 0,
    uniqueCoCodes: data?.unique_co_codes || 0,
    uniquePdCodes: data?.unique_pd_codes || 0,
    secondsTotal: typeof data?.seconds_total === "number" ? data.seconds_total : null,
    byType: (data?.by_type || []).map(mapStatType),
    byEmployee: (data?.by_employee || []).map((item) => ({
      employeeId: String(item.employee_id ?? ""),
      name: item.name || "",
      count: item.count || 0,
      seconds: typeof item.seconds === "number" ? item.seconds : null,
      byType: (item.by_type || []).map(mapStatType),
    })),
    byDay: (data?.by_day || []).map((day) => ({
      id: day.id,
      count: day.count || 0,
      byType: (day.by_type || []).map(mapStatType),
    })),
  };
}

export function daySeriesFromStats(byDay, from, to) {
  const map = new Map();
  for (const day of byDay || []) {
    const counts = emptyTypeCounts();
    for (const type of day.byType || []) {
      if (type.id in counts) counts[type.id] = type.count || 0;
    }
    map.set(day.id, counts);
  }
  return buildDaySeries(map, from, to);
}

export function secondsSummaryFromStats(byType) {
  const items = (byType || []).map((item) => ({
    id: item.id,
    label: item.label,
    count: item.count || 0,
    seconds: item.seconds,
  }));
  const withSeconds = items.filter((item) => item.seconds != null);
  return {
    items,
    totalCount: items.reduce((sum, item) => sum + item.count, 0),
    total:
      withSeconds.length === 0
        ? null
        : withSeconds.reduce((sum, item) => sum + item.seconds, 0),
  };
}

export const emptyServerStats = {
  total: 0,
  uniqueCoCodes: 0,
  uniquePdCodes: 0,
  secondsTotal: null,
  byType: [],
  byEmployee: [],
  byDay: [],
};

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

export const ordersAtom = atom([]);
export const ordersLoadingAtom = atom(false);
export const ordersTotalAtom = atom(0);
export const ordersPageSizeAtom = atom(ORDERS_PAGE_SIZE);
export const orderPageAtom = atom(0);
export const pickerOrdersAtom = atom([]);
export const appliedListQueryAtom = atom({
  q: "",
  type: "",
  kind: "",
  from: "",
  to: "",
  page: 0,
  empId: "",
});

let listGeneration = 0;

function listFilters(get, overrides = {}) {
  const applied = get(appliedListQueryAtom);
  return {
    q: overrides.q ?? applied.q,
    type: overrides.type ?? applied.type,
    kind: overrides.kind ?? applied.kind,
    from: overrides.from ?? applied.from,
    to: overrides.to ?? applied.to,
    page: overrides.page ?? get(orderPageAtom),
    empId: overrides.empId ?? applied.empId ?? "",
  };
}

async function refreshOrders(get, set, overrides = {}) {
  const generation = ++listGeneration;
  const filters = listFilters(get, overrides);
  set(ordersLoadingAtom, true);
  try {
    const data = await api("/orders", { query: buildOrderListQuery(filters) });
    if (generation !== listGeneration) return get(ordersAtom);
    const items = (data.items || []).map(mapOrder);
    const total = Number(data.total ?? items.length);
    const size = Number(data.page_size || ORDERS_PAGE_SIZE);
    const pageCount = Math.max(1, Math.ceil(total / size));
    const page = Math.min(Math.max(0, (Number(data.page) || 1) - 1), pageCount - 1);
    set(appliedListQueryAtom, { ...filters, page });
    set(orderPageAtom, page);
    set(ordersPageSizeAtom, size);
    set(ordersTotalAtom, total);
    set(unmatchedSearchAtom, Array.isArray(data.unmatched) ? data.unmatched : []);
    set(ordersAtom, items);
    return items;
  } finally {
    if (generation !== listGeneration) return;
    set(ordersLoadingAtom, false);
  }
}

function findOrder(current, code, type, kind) {
  return current.find((order) => sameRecord(order, code, type, kind));
}

export const dateFromAtom = atom("");
export const dateToAtom = atom("");
export const searchQueryAtom = atom("");
export const orderTypeFilterAtom = atom("");
export const orderKindFilterAtom = atom("");

export const unmatchedSearchAtom = atom([]);

export const accessibleOrdersAtom = atom((get) => {
  if (!get(sessionAtom)) return [];
  return get(ordersAtom);
});

export const filteredOrdersAtom = atom((get) => get(accessibleOrdersAtom));

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
  return sameEmployeeId(order.employeeId, session.employeeId);
}

export const addOrdersAtom = atom(
  null,
  async (get, set, codes, _employeeId, type, note = "", seconds = null, kind = "co") => {
    const current = get(ordersAtom);
    if (seconds != null && get(sessionAtom)?.role !== "manager") {
      return {
        orders: current,
        added: [],
        duplicates: [],
        error: "Chỉ quản lý mới sửa được số giây.",
      };
    }
    try {
      const data = await api("/orders", {
        method: "POST",
        body: {
          codes,
          type,
          note,
          kind: getOrderKind(kind),
          ...(typeof seconds === "number" ? { seconds } : {}),
        },
      });
      const orders = await refreshOrders(get, set, { page: 0 });
      return {
        orders,
        added: (data.added || []).map(mapOrder),
        duplicates: data.duplicates || [],
        error: "",
      };
    } catch (error) {
      return { orders: current, added: [], duplicates: [], error: error.message };
    }
  },
);

export const removeOrderAtom = atom(null, async (get, set, code, type, kind = "co") => {
  const session = get(sessionAtom);
  const current = get(ordersAtom);
  const order = findOrder(current, code, type, kind);
  if (!order?.id) {
    return { orders: current, error: "Không tìm thấy đơn hàng." };
  }
  if (!ownsOrder(session, order)) {
    return { orders: current, error: "Không thể xóa đơn của người khác." };
  }
  try {
    await api(`/orders/${order.id}`, { method: "DELETE" });
    const orders = await refreshOrders(get, set);
    return { orders, error: "" };
  } catch (error) {
    return { orders: current, error: error.message || "Không thể xóa đơn hàng." };
  }
});

export const removeOrdersByKeysAtom = atom(null, async (get, set, keys) => {
  const session = get(sessionAtom);
  const current = get(ordersAtom);
  const allowed = [...keys]
    .map((key) => current.find((item) => recordKey(item) === key))
    .filter((order) => ownsOrder(session, order) && order?.id);
  if (!allowed.length) {
    return { orders: current, error: "Không tìm thấy đơn hàng." };
  }
  try {
    await api("/orders/delete", {
      method: "POST",
      body: { ids: allowed.map((order) => order.id) },
    });
    const orders = await refreshOrders(get, set);
    return { orders, error: "" };
  } catch (error) {
    return { orders: current, error: error.message || "Không thể xóa đơn hàng." };
  }
});

export const updateOrderAtom = atom(
  null,
  async (get, set, originalCode, originalType, patch) => {
    const session = get(sessionAtom);
    const current = get(ordersAtom);
    const existing = findOrder(current, originalCode, originalType, patch?.kind);
    if (!ownsOrder(session, existing)) {
      return { orders: current, error: "Không thể sửa đơn của người khác." };
    }
    const local = updateOrder(current, originalCode, originalType, patch);
    if (local.error) return local;
    if (!existing?.id) {
      return { orders: current, error: "Không tìm thấy đơn hàng." };
    }
    try {
      await api(`/orders/${existing.id}`, {
        method: "PUT",
        body: {
          code: patch.code,
          type: patch.type,
          note: patch.note,
          kind: getOrderKind(patch.kind),
        },
      });
      const orders = await refreshOrders(get, set);
      return { orders, error: "" };
    } catch (error) {
      return { orders: current, error: error.message };
    }
  },
);

export const updateOrderSecondsAtom = atom(
  null,
  async (get, set, code, type, seconds, kind = "co") => {
    const current = get(ordersAtom);
    if (get(sessionAtom)?.role !== "manager") {
      return { orders: current, error: "Chỉ quản lý mới sửa được số giây." };
    }
    const order = findOrder(current, code, type, kind);
    if (!order?.id) {
      return { orders: current, error: "Không tìm thấy đơn hàng." };
    }
    try {
      await api(`/orders/${order.id}/seconds`, {
        method: "PUT",
        body: { seconds },
      });
      const orders = await refreshOrders(get, set);
      return { orders, error: "" };
    } catch (error) {
      return { orders: current, error: error.message };
    }
  },
);

export const updateOrdersSecondsAtom = atom(null, async (get, set, keys, seconds) => {
  const current = get(ordersAtom);
  if (get(sessionAtom)?.role !== "manager") {
    return { orders: current, error: "Chỉ quản lý mới sửa được số giây." };
  }
  const pool = [...get(pickerOrdersAtom), ...current];
  const ids = [];
  const seen = new Set();
  for (const key of keys) {
    const order = pool.find((item) => recordKey(item) === key);
    if (!order?.id || seen.has(order.id)) continue;
    seen.add(order.id);
    ids.push(order.id);
  }
  if (!ids.length) {
    return { orders: current, error: "Chọn ít nhất một mã đơn." };
  }
  try {
    await api("/orders/seconds", {
      method: "PUT",
      body: { ids, seconds },
    });
    const orders = await refreshOrders(get, set);
    return { orders, error: "" };
  } catch (error) {
    return { orders: current, error: error.message };
  }
});

export const clearOrdersAtom = atom(null, async (get, set) => {
  const session = get(sessionAtom);
  const current = get(ordersAtom);
  if (!session) return current;
  try {
    await api("/orders/clear", { method: "POST" });
    const orders = await refreshOrders(get, set, { page: 0 });
    return orders;
  } catch {
    return current;
  }
});

export const loadOrdersAtom = atom(null, async (get, set, overrides) => {
  return refreshOrders(get, set, overrides || {});
});
