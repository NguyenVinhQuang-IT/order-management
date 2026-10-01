import { useEffect, useMemo, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  deleteEmployeeAtom,
  employeesAtom,
  listDirectoryEmployees,
  sameEmployeeId,
  sessionAtom,
} from "../auth";
import DialogOverlay from "../components/DialogOverlay";
import EmployeeDirectory from "../components/EmployeeDirectory";
import EmployeeFormDialog from "../components/EmployeeFormDialog";
import GlobalNav from "../components/GlobalNav";
import {
  ghostButtonClass,
  primaryButtonClass,
} from "../components/order-entry/styles";
import { useToast } from "../components/Toast";
import { api } from "../api";
import { emptyServerStats, mapServerStats } from "../orders";

export default function Employees() {
  const notify = useToast();
  const session = useAtomValue(sessionAtom);
  const employees = useAtomValue(employeesAtom);
  const deleteEmployee = useSetAtom(deleteEmployeeAtom);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [stats, setStats] = useState(emptyServerStats);

  useEffect(() => {
    let cancelled = false;
    api("/stats")
      .then((data) => {
        if (!cancelled) setStats(mapServerStats(data));
      })
      .catch(() => {
        if (!cancelled) setStats(emptyServerStats);
      });
    return () => {
      cancelled = true;
    };
  }, [employees]);
  const rows = useMemo(() => {
    return listDirectoryEmployees(employees).map((person) => ({
      ...person,
      count:
        stats.byEmployee.find((item) =>
          sameEmployeeId(item.employeeId, person.employeeId),
        )?.count ?? 0,
    }));
  }, [employees, stats.byEmployee]);

  useEffect(() => {
    document.title = "Nhân viên";
    return () => {
      document.title = "Order";
    };
  }, []);

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  function handleEdit(row) {
    setPendingDelete(null);
    setEditing(row);
    setFormOpen(true);
  }

  function handleDelete(row) {
    setFormOpen(false);
    setEditing(null);
    setPendingDelete(row);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteEmployee(pendingDelete.employeeId);
      notify(`Đã xóa ${pendingDelete.name}.`);
      setPendingDelete(null);
    } catch (error) {
      notify(error.message || "Không thể xóa nhân viên.", "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-parchment">
      <GlobalNav />

      <main className="mx-auto max-w-[1200px] px-6 py-12 tablet:px-8 tablet:py-20">
        <div className="flex flex-col gap-6 tablet:flex-row tablet:items-end tablet:justify-between">
          <div>
            <h1 className="m-0 font-sans text-[34px] font-semibold leading-[1.1] tracking-[-0.01em] text-ink desk:text-[40px]">
              Nhân viên.
            </h1>
            <p className="mt-4 max-w-[28ch] font-sans text-[21px] font-normal leading-[1.19] tracking-[0.196px] text-ink-muted-80 desk:text-[28px] desk:leading-[1.14]">
              Chọn nhân viên để xem chi tiết.
            </p>
          </div>
          <button
            className={primaryButtonClass}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={formOpen && !editing}
            onClick={() => {
              setPendingDelete(null);
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Thêm nhân viên
          </button>
        </div>

        <section className="mt-10" aria-labelledby="employee-list-heading">
          <h2
            id="employee-list-heading"
            className="m-0 mb-4 font-sans text-[21px] font-semibold leading-[1.19] tracking-[0.231px] text-ink"
          >
            Danh sách
            {rows.length ? (
              <span className="ml-2 font-normal text-ink-muted-48">
                {rows.length}
              </span>
            ) : null}
          </h2>
          <EmployeeDirectory
            rows={rows}
            empty="Chưa có nhân viên."
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </section>
      </main>

      <EmployeeFormDialog
        open={formOpen}
        employee={editing}
        onClose={closeForm}
      />

      {pendingDelete ? (
        <DialogOverlay
          onClose={() => {
            if (!deleting) setPendingDelete(null);
          }}
        >
          <div
            className="w-full rounded-t-[18px] border border-hairline bg-canvas p-6 shadow-product tablet:max-w-[440px] tablet:rounded-[18px] tablet:p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-delete-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2
              id="employee-delete-title"
              className="m-0 font-sans text-[21px] font-semibold leading-[1.19] tracking-[0.231px] text-ink"
            >
              Xóa nhân viên
            </h2>
            <p className="mt-4 m-0 text-[17px] font-normal leading-[1.47] tracking-[-0.374px] text-ink-muted-80">
              {session &&
              sameEmployeeId(session.employeeId, pendingDelete.employeeId)
                ? "Không thể xóa tài khoản đang đăng nhập."
                : pendingDelete.count
                  ? `Không thể xóa ${pendingDelete.name} vì đang có đơn hàng.`
                  : `Xóa ${pendingDelete.name} (mã ${pendingDelete.employeeId})?`}
            </p>
            <div className="mt-8 flex justify-end gap-3">
              <button
                className={ghostButtonClass}
                type="button"
                disabled={deleting}
                onClick={() => setPendingDelete(null)}
              >
                Hủy
              </button>
              {session &&
              sameEmployeeId(session.employeeId, pendingDelete.employeeId) ? null : pendingDelete.count ? null : (
                <button
                  className="h-11 cursor-pointer rounded-full border-0 bg-[#e30000] px-[22px] py-[11px] text-[17px] font-normal leading-none tracking-[-0.374px] text-white hover:bg-[#c40000] active:scale-95 disabled:cursor-default disabled:opacity-[0.64]"
                  type="button"
                  disabled={deleting}
                  onClick={confirmDelete}
                >
                  {deleting ? "Đang xóa…" : "Xóa"}
                </button>
              )}
            </div>
          </div>
        </DialogOverlay>
      ) : null}
    </div>
  );
}
