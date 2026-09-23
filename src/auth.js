import { atom } from "jotai";
import { atomWithStorage, RESET } from "jotai/utils";
import { api, clearToken, mapEmployee, setToken } from "./api";
import { sessionJsonStorage } from "./storage";

const STORAGE_KEY = "om_session";

export const ROLES = [
  { id: "employee", label: "Nhân viên" },
  { id: "manager", label: "Quản lý" },
];

export function getRoleLabel(roleId) {
  return ROLES.find((role) => role.id === roleId)?.label ?? "—";
}

export function sameEmployeeId(left, right) {
  const a = String(left ?? "").replace(/^0+(?=\d)/, "");
  const b = String(right ?? "").replace(/^0+(?=\d)/, "");
  return a === b;
}

export function getEmployeeName(employeeId, employees = []) {
  return (
    employees.find((item) => sameEmployeeId(item.employeeId, employeeId))?.name ??
    "—"
  );
}

export function getEmployee(employeeId, employees = []) {
  return (
    employees.find((item) => sameEmployeeId(item.employeeId, employeeId)) ?? null
  );
}

export function employeePath(employeeId) {
  return `/nhan-vien/${encodeURIComponent(employeeId)}`;
}

export function listDirectoryEmployees(employees = []) {
  return [...employees].sort((left, right) =>
    String(left.employeeId).localeCompare(String(right.employeeId), "vi"),
  );
}

export function homePathForRole(role) {
  return role === "manager" ? "/thong-ke" : "/";
}

export const sessionAtom = atomWithStorage(
  STORAGE_KEY,
  null,
  sessionJsonStorage,
  { getOnInit: true },
);

export const employeesAtom = atom([]);

export const isAuthenticatedAtom = atom((get) => Boolean(get(sessionAtom)));

export const isManagerAtom = atom(
  (get) => get(sessionAtom)?.role === "manager",
);

export const signInAtom = atom(
  null,
  async (_get, set, employeeId, password, role) => {
    if (!ROLES.some((item) => item.id === role)) {
      throw new Error("Chọn vai trò.");
    }
    const data = await api("/auth/login", {
      method: "POST",
      body: {
        employee_id: String(employeeId).trim(),
        password,
        role,
      },
    });
    setToken(data.token);
    const session = {
      employeeId: String(data.user.employee_id ?? data.user.id),
      name: data.user.name,
      role: data.user.role,
    };
    set(sessionAtom, session);
    return session;
  },
);

export const createEmployeeAtom = atom(null, async (get, set, payload) => {
  const data = await api("/employees", {
    method: "POST",
    body: {
      id: payload.employeeId,
      name: payload.name,
      role: payload.role,
      password: payload.password,
    },
  });
  const created = mapEmployee(data);
  const current = get(employeesAtom);
  if (current.some((item) => sameEmployeeId(item.employeeId, created.employeeId))) {
    set(employeesAtom, current);
    return created;
  }
  set(employeesAtom, listDirectoryEmployees([...current, created]));
  return created;
});

export const updateEmployeeAtom = atom(null, async (get, set, employeeId, payload) => {
  const body = {
    name: payload.name,
    role: payload.role,
  };
  if (payload.password) body.password = payload.password;
  const data = await api(`/employees/${employeeId}`, {
    method: "PUT",
    body,
  });
  const updated = mapEmployee(data);
  set(
    employeesAtom,
    listDirectoryEmployees(
      get(employeesAtom).map((item) =>
        sameEmployeeId(item.employeeId, employeeId) ? updated : item,
      ),
    ),
  );
  const session = get(sessionAtom);
  if (session && sameEmployeeId(session.employeeId, employeeId)) {
    set(sessionAtom, {
      ...session,
      name: updated.name,
      role: updated.role,
    });
  }
  return updated;
});

export const deleteEmployeeAtom = atom(null, async (get, set, employeeId) => {
  const session = get(sessionAtom);
  if (session && sameEmployeeId(session.employeeId, employeeId)) {
    throw new Error("Không thể xóa tài khoản đang đăng nhập.");
  }
  await api(`/employees/${employeeId}`, { method: "DELETE" });
  set(
    employeesAtom,
    get(employeesAtom).filter(
      (item) => !sameEmployeeId(item.employeeId, employeeId),
    ),
  );
});

export const signOutAtom = atom(null, (_get, set) => {
  clearToken();
  set(sessionAtom, RESET);
  set(employeesAtom, []);
});

