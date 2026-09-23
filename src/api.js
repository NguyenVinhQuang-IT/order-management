const TOKEN_KEY = "om_token";

let unauthorizedHandler = null;

export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
}

export function getToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function clearToken() {
  setToken(null);
}

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = "GET", body, query } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let url = `/api${path}`;
  if (query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value == null || value === "") continue;
      params.set(key, String(value));
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Không kết nối được máy chủ.");
  }

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (response.status === 401) {
    unauthorizedHandler?.();
    throw new ApiError(data.error || "Cần đăng nhập.", 401);
  }
  if (!response.ok) {
    throw new ApiError(data.error || "Không thể hoàn tất thao tác.", response.status);
  }
  return data;
}

export function mapOrder(item) {
  return {
    id: item.id,
    code: item.code,
    type: item.type,
    kind: item.kind === "pd" ? "pd" : "co",
    employeeId: String(item.employee_id ?? item.emp_id ?? ""),
    empName: item.emp_name || "",
    note: item.note || "",
    createdAt: item.created_at,
    ...(typeof item.seconds === "number" ? { seconds: item.seconds } : {}),
  };
}

export function mapEmployee(item) {
  return {
    employeeId: String(item.employee_id ?? item.id),
    name: item.name,
    role: item.role,
  };
}
