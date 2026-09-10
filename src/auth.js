const STORAGE_KEY = "om_session";

const DEMO = {
  employeeId: "001",
  password: "123456",
  name: "Quang",
};

export function getSession() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  return Boolean(getSession());
}

export function signIn(employeeId, password) {
  return new Promise((resolve, reject) => {
    window.setTimeout(() => {
      const normalized = employeeId.trim();
      if (normalized === DEMO.employeeId && password === DEMO.password) {
        const session = { employeeId: DEMO.employeeId, name: DEMO.name };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        resolve(session);
        return;
      }
      reject(new Error("Mã nhân viên hoặc mật khẩu không đúng."));
    }, 720);
  });
}

export function signOut() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export { DEMO };
