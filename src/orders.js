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

export function getOrders() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveOrders(orders) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
}

export function normalizeNote(raw) {
  return String(raw ?? "").trim();
}

export function addOrders(codes, employeeId, type, note = "") {
  const current = getOrders();
  const existing = new Set(current.map((order) => orderKey(order.code, order.type)));
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

  const next = [...added, ...current];
  saveOrders(next);
  return { orders: next, added, duplicates };
}

export function removeOrder(code, type) {
  const next = getOrders().filter(
    (order) => !(order.code === code && order.type === type),
  );
  saveOrders(next);
  return next;
}

export function removeOrdersByKeys(keys) {
  const keySet = keys instanceof Set ? keys : new Set(keys);
  const next = getOrders().filter(
    (order) => !keySet.has(orderKey(order.code, order.type)),
  );
  saveOrders(next);
  return next;
}

export function updateOrder(originalCode, originalType, patch) {
  const current = getOrders();
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
    return { orders: current, error: "Chọn loại đơn." };
  }

  const key = orderKey(code, type);
  const duplicate = current.some(
    (order, itemIndex) =>
      itemIndex !== index && orderKey(order.code, order.type) === key,
  );
  if (duplicate) {
    return { orders: current, error: "Mã đơn này đã có với cùng loại." };
  }

  const next = current.map((order, itemIndex) =>
    itemIndex === index
      ? { ...order, code, type, note, updatedAt: new Date().toISOString() }
      : order,
  );
  saveOrders(next);
  return { orders: next, error: "" };
}

export function clearOrders() {
  saveOrders([]);
  return [];
}
