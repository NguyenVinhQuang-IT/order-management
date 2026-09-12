import { atom } from "jotai";
import { atomWithStorage, RESET } from "jotai/utils";
import { sessionJsonStorage } from "./storage";

const STORAGE_KEY = "om_session";

const ACCOUNTS = [
  {
    employeeId: "001",
    password: "123456",
    name: "Quang",
    role: "employee",
  },
  {
    employeeId: "002",
    password: "123456",
    name: "Lan",
    role: "employee",
  },
  {
    employeeId: "169",
    password: "123456",
    name: "Trúc",
    role: "manager",
  },
];

export const ROLES = [
  { id: "employee", label: "Nhân viên" },
  { id: "manager", label: "Quản lý" },
];

export function getRoleLabel(roleId) {
  return ROLES.find((role) => role.id === roleId)?.label ?? "—";
}

export function getEmployeeName(employeeId) {
  return ACCOUNTS.find((account) => account.employeeId === employeeId)?.name ?? "—";
}

export function getEmployee(employeeId) {
  return ACCOUNTS.find((account) => account.employeeId === employeeId) ?? null;
}

export function employeePath(employeeId) {
  return `/nhan-vien/${encodeURIComponent(employeeId)}`;
}

export function listDirectoryEmployees() {
  return ACCOUNTS.map((account) => ({
    employeeId: account.employeeId,
    name: account.name,
    role: account.role,
  })).sort((left, right) =>
    left.employeeId.localeCompare(right.employeeId, "vi"),
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

export const isAuthenticatedAtom = atom((get) => Boolean(get(sessionAtom)));

export const isManagerAtom = atom(
  (get) => get(sessionAtom)?.role === "manager",
);

export const signInAtom = atom(
  null,
  (_get, set, employeeId, password, role) => {
    return new Promise((resolve, reject) => {
      window.setTimeout(() => {
        if (!ROLES.some((item) => item.id === role)) {
          reject(new Error("Chọn vai trò."));
          return;
        }
        const normalized = employeeId.trim();
        const account = ACCOUNTS.find(
          (item) => item.employeeId === normalized && item.password === password,
        );
        if (!account) {
          reject(new Error("Mã nhân viên hoặc mật khẩu không đúng."));
          return;
        }
        if (account.role !== role) {
          reject(new Error("Tài khoản không khớp với vai trò đã chọn."));
          return;
        }
        const session = {
          employeeId: account.employeeId,
          name: account.name,
          role: account.role,
        };
        set(sessionAtom, session);
        resolve(session);
      }, 720);
    });
  },
);

export const signOutAtom = atom(null, (_get, set) => {
  set(sessionAtom, RESET);
});

export { ACCOUNTS };
