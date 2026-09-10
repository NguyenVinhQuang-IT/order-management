import { atom } from "jotai";
import { atomWithStorage, RESET } from "jotai/utils";
import { sessionJsonStorage } from "./storage";

const STORAGE_KEY = "om_session";

const DEMO = {
  employeeId: "001",
  password: "123456",
  name: "Quang",
};

export const ROLES = [
  { id: "employee", label: "Nhân viên" },
  { id: "manager", label: "Quản lý" },
];

export function getRoleLabel(roleId) {
  return ROLES.find((role) => role.id === roleId)?.label ?? "—";
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
        if (normalized === DEMO.employeeId && password === DEMO.password) {
          const session = {
            employeeId: DEMO.employeeId,
            name: DEMO.name,
            role,
          };
          set(sessionAtom, session);
          resolve(session);
          return;
        }
        reject(new Error("Mã nhân viên hoặc mật khẩu không đúng."));
      }, 720);
    });
  },
);

export const signOutAtom = atom(null, (_get, set) => {
  set(sessionAtom, RESET);
});

export { DEMO };
