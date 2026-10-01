import { useEffect, useRef, useState } from "react";
import { useSetAtom } from "jotai";
import { createEmployeeAtom, ROLES, updateEmployeeAtom } from "../auth";
import DialogOverlay from "./DialogOverlay";
import {
  ghostButtonClass,
  primaryButtonClass,
} from "./order-entry/styles";
import { useToast } from "./Toast";

const EMPLOYEE_ID_PATTERN = /^\d{1,20}$/;

const inputClass =
  "h-11 w-full rounded-full border bg-canvas px-5 py-3 text-[17px] font-normal leading-[1.44] tracking-[-0.374px] text-ink outline-none transition-[border-color] duration-150 disabled:bg-black/4 disabled:text-ink-muted-48";

function fieldInputClass(invalid) {
  return invalid
    ? `${inputClass} border-ink`
    : `${inputClass} border-black/8 focus:border-primary-focus focus:shadow-[0_0_0_2px_#0071e3]`;
}

const emptyForm = {
  employeeId: "",
  name: "",
  pbb: "",
  pba: "",
  role: "employee",
  password: "",
};

export default function EmployeeFormDialog({ open, employee = null, onClose }) {
  const notify = useToast();
  const createEmployee = useSetAtom(createEmployeeAtom);
  const updateEmployee = useSetAtom(updateEmployeeAtom);
  const firstFieldRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const isEdit = Boolean(employee);
  const [form, setForm] = useState(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm(emptyForm);
      setShowPassword(false);
      setFieldErrors({});
      setFormError("");
      setSubmitting(false);
      return undefined;
    }

    setForm(
      employee
        ? {
            employeeId: String(employee.employeeId ?? ""),
            name: employee.name ?? "",
            pbb: employee.pbb ?? "",
            pba: employee.pba ?? "",
            role: employee.role || "employee",
            password: "",
          }
        : emptyForm,
    );
    setShowPassword(false);
    setFieldErrors({});
    setFormError("");

    const frame = window.requestAnimationFrame(() => {
      firstFieldRef.current?.focus();
    });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKey(event) {
      if (event.key === "Escape") onCloseRef.current();
    }
    window.addEventListener("keydown", handleKey);

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [open, employee]);

  if (!open) return null;

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((current) => ({ ...current, [name]: undefined }));
    }
    if (formError) setFormError("");
  }

  function validate() {
    const next = {};
    const employeeId = form.employeeId.trim();
    if (!isEdit) {
      if (!employeeId) {
        next.employeeId = "Nhập mã nhân viên.";
      } else if (!EMPLOYEE_ID_PATTERN.test(employeeId)) {
        next.employeeId = "Mã nhân viên không hợp lệ.";
      }
    }
    if (!form.name.trim()) {
      next.name = "Nhập tên nhân viên.";
    }
    if (!ROLES.some((item) => item.id === form.role)) {
      next.role = "Chọn vai trò.";
    }
    if (!isEdit && !form.password) {
      next.password = "Nhập mật khẩu.";
    }
    return next;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const next = validate();
    setFieldErrors(next);
    if (Object.keys(next).length) {
      setFormError("");
      notify(Object.values(next)[0], "error");
      return;
    }

    setSubmitting(true);
    setFormError("");
    try {
      if (isEdit) {
        const updated = await updateEmployee(employee.employeeId, {
          name: form.name.trim(),
          pbb: form.pbb.trim(),
          pba: form.pba.trim(),
          role: form.role,
          password: form.password,
        });
        notify(`Đã cập nhật ${updated.name}.`);
      } else {
        const created = await createEmployee({
          employeeId: form.employeeId.trim(),
          name: form.name.trim(),
          pbb: form.pbb.trim(),
          pba: form.pba.trim(),
          role: form.role,
          password: form.password,
        });
        notify(`Đã thêm ${created.name}.`);
      }
      onClose();
    } catch (error) {
      const message =
        error.message ||
        (isEdit ? "Không thể cập nhật nhân viên." : "Không thể thêm nhân viên.");
      setFormError(message);
      notify(message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogOverlay onClose={onClose}>
      <div
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-[18px] border border-hairline bg-canvas p-6 shadow-product tablet:max-w-[560px] tablet:rounded-[18px] tablet:p-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-form-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2
            id="employee-form-title"
            className="m-0 font-sans text-[21px] font-semibold leading-[1.19] tracking-[0.231px] text-ink"
          >
            {isEdit ? "Sửa nhân viên" : "Thêm nhân viên"}
          </h2>
          <button className={ghostButtonClass} type="button" onClick={onClose}>
            Đóng
          </button>
        </div>

        <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
              Mã nhân viên
            </span>
            <input
              ref={isEdit ? undefined : firstFieldRef}
              className={fieldInputClass(Boolean(fieldErrors.employeeId))}
              type="text"
              name="employeeId"
              inputMode="numeric"
              pattern="[0-9]*"
              spellCheck={false}
              autoComplete="off"
              value={form.employeeId}
              disabled={isEdit}
              onChange={(event) =>
                updateField("employeeId", event.target.value.replace(/\D/g, ""))
              }
              aria-invalid={Boolean(fieldErrors.employeeId)}
            />
            {fieldErrors.employeeId ? (
              <span className="text-sm font-normal leading-[1.43] tracking-[-0.224px] text-warn">
                {fieldErrors.employeeId}
              </span>
            ) : null}
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
              Tên
            </span>
            <input
              ref={isEdit ? firstFieldRef : undefined}
              className={fieldInputClass(Boolean(fieldErrors.name))}
              type="text"
              name="name"
              autoComplete="off"
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              aria-invalid={Boolean(fieldErrors.name)}
            />
            {fieldErrors.name ? (
              <span className="text-sm font-normal leading-[1.43] tracking-[-0.224px] text-warn">
                {fieldErrors.name}
              </span>
            ) : null}
          </label>

          <div className="grid grid-cols-1 gap-6 tablet:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
                Mã PBB
              </span>
              <input
                className={fieldInputClass(Boolean(fieldErrors.pbb))}
                type="text"
                name="pbb"
                autoComplete="off"
                spellCheck={false}
                value={form.pbb}
                onChange={(event) => updateField("pbb", event.target.value)}
                aria-invalid={Boolean(fieldErrors.pbb)}
              />
              {fieldErrors.pbb ? (
                <span className="text-sm font-normal leading-[1.43] tracking-[-0.224px] text-warn">
                  {fieldErrors.pbb}
                </span>
              ) : null}
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
                Mã PBA
              </span>
              <input
                className={fieldInputClass(Boolean(fieldErrors.pba))}
                type="text"
                name="pba"
                autoComplete="off"
                spellCheck={false}
                value={form.pba}
                onChange={(event) => updateField("pba", event.target.value)}
                aria-invalid={Boolean(fieldErrors.pba)}
              />
              {fieldErrors.pba ? (
                <span className="text-sm font-normal leading-[1.43] tracking-[-0.224px] text-warn">
                  {fieldErrors.pba}
                </span>
              ) : null}
            </label>
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
            >
              {ROLES.map((item) => {
                const selected = form.role === item.id;
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
                    onClick={() => updateField("role", item.id)}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
            {fieldErrors.role ? (
              <span className="text-sm font-normal leading-[1.43] tracking-[-0.224px] text-warn">
                {fieldErrors.role}
              </span>
            ) : null}
          </div>

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
              autoComplete="new-password"
              value={form.password}
              onChange={(event) => updateField("password", event.target.value)}
              aria-invalid={Boolean(fieldErrors.password)}
              placeholder={isEdit ? "Để trống nếu giữ mật khẩu hiện tại" : ""}
            />
            {fieldErrors.password ? (
              <span className="text-sm font-normal leading-[1.43] tracking-[-0.224px] text-warn">
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

          <div className="flex justify-end gap-3">
            <button className={ghostButtonClass} type="button" onClick={onClose}>
              Hủy
            </button>
            <button className={primaryButtonClass} type="submit" disabled={submitting}>
              {submitting
                ? "Đang lưu…"
                : isEdit
                  ? "Lưu"
                  : "Thêm nhân viên"}
            </button>
          </div>
        </form>
      </div>
    </DialogOverlay>
  );
}
