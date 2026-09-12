import { useEffect, useMemo } from "react";
import { useAtomValue } from "jotai";
import { listDirectoryEmployees } from "../auth";
import EmployeeDirectory from "../components/EmployeeDirectory";
import GlobalNav from "../components/GlobalNav";
import { ordersAtom, summarizeOrders } from "../orders";

export default function Employees() {
  const orders = useAtomValue(ordersAtom);
  const stats = useMemo(() => summarizeOrders(orders), [orders]);
  const rows = useMemo(() => {
    const byId = new Map(
      stats.byEmployee.map((item) => [item.employeeId, item]),
    );
    return listDirectoryEmployees().map((person) => ({
      ...person,
      count: byId.get(person.employeeId)?.count ?? 0,
    }));
  }, [stats.byEmployee]);

  useEffect(() => {
    document.title = "Nhân viên";
    return () => {
      document.title = "Order";
    };
  }, []);

  return (
    <div className="min-h-screen bg-parchment">
      <GlobalNav />

      <main className="mx-auto max-w-[1200px] px-6 py-12 tablet:px-8 tablet:py-20">
        <h1 className="m-0 font-sans text-[34px] font-semibold leading-[1.1] tracking-[-0.01em] text-ink desk:text-[40px]">
          Nhân viên.
        </h1>
        <p className="mt-4 max-w-[28ch] font-sans text-[21px] font-normal leading-[1.19] tracking-[0.196px] text-ink-muted-80 desk:text-[28px] desk:leading-[1.14]">
          Chọn nhân viên để xem chi tiết.
        </p>

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
          <EmployeeDirectory rows={rows} empty="Chưa có nhân viên." />
        </section>
      </main>
    </div>
  );
}
