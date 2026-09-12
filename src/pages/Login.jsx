import { useState } from "react";
import { useSetAtom } from "jotai";
import { useNavigate } from "react-router-dom";
import GlobalNav from "../components/GlobalNav";
import { useToast } from "../components/Toast";
import { ACCOUNTS, homePathForRole, ROLES, signInAtom } from "../auth";

const EMPLOYEE_ID_PATTERN = /^\d{1,20}$/;

const inputClass =
  "h-11 w-full rounded-full border bg-canvas px-5 py-3 text-[17px] font-normal leading-[1.44] tracking-[-0.374px] text-ink outline-none transition-[border-color] duration-150";

function fieldInputClass(invalid) {
  return invalid
    ? `${inputClass} border-ink`
    : `${inputClass} border-black/8 focus:border-primary-focus focus:shadow-[0_0_0_2px_#0071e3]`;
}

export default function Login() {
  const navigate = useNavigate();
  const notify = useToast();
  const signIn = useSetAtom(signInAtom);
  const [role, setRole] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function validate() {
    const next = {};
    if (!ROLES.some((item) => item.id === role)) {
      next.role = "Chọn vai trò.";
    }
    const trimmed = employeeId.trim();
    if (!trimmed) {
      next.employeeId = "Nhập mã nhân viên.";
    } else if (!EMPLOYEE_ID_PATTERN.test(trimmed)) {
      next.employeeId = "Mã nhân viên không hợp lệ.";
    }
    if (!password) {
      next.password = "Nhập mật khẩu.";
    }
    return next;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const next = validate();
    setFieldErrors(next);
    if (Object.keys(next).length > 0) {
      setFormError("");
      notify(Object.values(next)[0], "error");
      return;
    }

    setSubmitting(true);
    setFormError("");
    try {
      await signIn(employeeId, password, role);
      notify("Đăng nhập thành công.");
      navigate(homePathForRole(role), { replace: true });
    } catch (error) {
      setFormError(error.message);
      notify(error.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-parchment">
      <GlobalNav />

      <main className="grid min-h-[calc(100vh-44px)] grid-cols-1 tablet:grid-cols-2">
        <section
          className="flex flex-col justify-center bg-tile px-6 py-12 text-white tablet:px-10 tablet:py-16 desk:px-16 desk:py-20"
          aria-label="Giới thiệu"
        >
          <div>
            <div className="mb-8 w-[min(100%,320px)] rounded-[18px] bg-canvas p-5">
              <img
                src="/logo.png"
                alt="BSN"
                className="block h-auto w-full"
              />
            </div>
            <p className="mb-3 font-sans text-[21px] font-semibold leading-[1.19] tracking-[0.231px]">
              Order
            </p>
            <h1 className="m-0 font-sans text-[28px] font-semibold leading-[1.1] tracking-[-0.01em] min-[420px]:text-[34px] desk:text-[40px]">
              Quản lý đơn hàng.
            </h1>
            <p className="mt-4 max-w-[14em] font-sans text-[21px] font-normal leading-[1.19] tracking-[0.196px] text-body-muted tablet:text-[24px] tablet:font-light tablet:leading-normal tablet:tracking-normal desk:text-[28px] desk:font-normal desk:leading-[1.14] desk:tracking-[0.196px]">
              Một nơi cho mọi đơn hàng.
            </p>
          </div>
        </section>

        <section className="flex items-start justify-center bg-parchment px-6 pb-16 pt-12 tablet:items-center tablet:px-8 tablet:py-20">
          <form
            className="flex w-full max-w-sm flex-col gap-6"
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="mb-2">
              <h2 className="m-0 font-sans text-[28px] font-semibold leading-[1.1] tracking-[-0.01em] text-ink min-[420px]:text-[34px] desk:text-[40px]">
                Đăng nhập
              </h2>
              <p className="mt-3 text-[17px] font-normal leading-[1.44] tracking-[-0.374px] text-ink-muted-80">
                Chọn vai trò rồi dùng mã nhân viên để tiếp tục.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
                Vai trò
              </span>
              <div
                className={`grid h-11 grid-cols-2 gap-1 rounded-full border p-1 ${
                  fieldErrors.role ? "border-ink bg-canvas" : "border-black/8 bg-canvas"
                }`}
                role="radiogroup"
                aria-label="Vai trò"
                aria-invalid={Boolean(fieldErrors.role)}
                aria-describedby={fieldErrors.role ? "role-error" : undefined}
              >
                {ROLES.map((item) => {
                  const selected = role === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`h-full cursor-pointer rounded-full border-0 text-[15px] font-normal leading-none tracking-[-0.224px] ${
                        selected
                          ? "bg-ink text-white"
                          : "bg-transparent text-ink-muted-80 hover:text-ink"
                      }`}
                      onClick={() => {
                        setRole(item.id);
                        if (fieldErrors.role) {
                          setFieldErrors((current) => ({
                            ...current,
                            role: undefined,
                          }));
                        }
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
              {fieldErrors.role ? (
                <span
                  className="text-sm font-normal leading-[1.43] tracking-[-0.224px] text-warn"
                  id="role-error"
                >
                  {fieldErrors.role}
                </span>
              ) : null}
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
                Mã nhân viên
              </span>
              <input
                className={fieldInputClass(Boolean(fieldErrors.employeeId))}
                type="text"
                name="employeeId"
                autoComplete="username"
                inputMode="numeric"
                pattern="[0-9]*"
                spellCheck={false}
                value={employeeId}
                onChange={(event) => {
                  setEmployeeId(event.target.value.replace(/\D/g, ""));
                  if (fieldErrors.employeeId) {
                    setFieldErrors((current) => ({
                      ...current,
                      employeeId: undefined,
                    }));
                  }
                }}
                aria-invalid={Boolean(fieldErrors.employeeId)}
                aria-describedby={fieldErrors.employeeId ? "employee-id-error" : undefined}
              />
              {fieldErrors.employeeId ? (
                <span
                  className="text-sm font-normal leading-[1.43] tracking-[-0.224px] text-warn"
                  id="employee-id-error"
                >
                  {fieldErrors.employeeId}
                </span>
              ) : null}
            </label>

            <label className="flex flex-col gap-2">
              <span className="flex w-full items-baseline justify-between">
                <span className="text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
                  Mật khẩu
                </span>
                <button
                  type="button"
                  className="cursor-pointer border-0 bg-transparent p-0 text-sm font-normal leading-[1.29] tracking-[-0.224px] text-primary"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? "Ẩn" : "Hiện"}
                </button>
              </span>
              <input
                className={fieldInputClass(Boolean(fieldErrors.password))}
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (fieldErrors.password) {
                    setFieldErrors((current) => ({
                      ...current,
                      password: undefined,
                    }));
                  }
                }}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? "password-error" : undefined}
              />
              {fieldErrors.password ? (
                <span
                  className="text-sm font-normal leading-[1.43] tracking-[-0.224px] text-warn"
                  id="password-error"
                >
                  {fieldErrors.password}
                </span>
              ) : null}
            </label>

            {formError ? (
              <p
                className="m-0 text-sm font-normal leading-[1.43] tracking-[-0.224px] text-warn"
                role="alert"
              >
                {formError}
              </p>
            ) : null}

            <button
              className="h-11 cursor-pointer rounded-full border-0 bg-primary px-[22px] py-[11px] text-[17px] font-normal leading-none tracking-[-0.374px] text-white hover:bg-primary-focus focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-primary-focus active:scale-95 disabled:cursor-default disabled:opacity-[0.64]"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Đang đăng nhập…" : "Đăng nhập"}
            </button>

            <div className="mt-2 text-center text-[12px] font-normal leading-[1.3] tracking-[-0.12px] text-ink-muted-48">
              {ACCOUNTS.map((account) => {
                const roleLabel =
                  ROLES.find((item) => item.id === account.role)?.label ??
                  account.role;
                return (
                  <p key={account.employeeId} className="m-0">
                    {roleLabel}: {account.employeeId} / {account.password}
                  </p>
                );
              })}
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
