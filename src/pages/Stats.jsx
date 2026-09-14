import { useEffect, useMemo } from "react";
import { useAtomValue } from "jotai";
import { getEmployee, getEmployeeName, listDirectoryEmployees } from "../auth";
import EmployeeDirectory from "../components/EmployeeDirectory";
import GlobalNav from "../components/GlobalNav";
import OrderFilters from "../components/OrderFilters";
import {
  ChartCard,
  DayBarChart,
  DonutChart,
  EmployeeBarChart,
} from "../components/StatsCharts";
import {
  dateFromAtom,
  dateToAtom,
  filteredOrdersAtom,
  hasActiveFiltersAtom,
  ordersAtom,
  summarizeOrders,
} from "../orders";
import {
  codeSecondsAtom,
  formatSeconds,
  sumOrderSeconds,
  sumSecondsByType,
  typeSecondsAtom,
} from "../settings";

function MetricCard({ label, value }) {
  return (
    <article className="rounded-[18px] border border-hairline bg-canvas p-6">
      <p className="m-0 text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink-muted-48">
        {label}
      </p>
      <p className="mt-3 font-sans text-[34px] font-semibold leading-[1.1] tracking-[-0.01em] text-ink tabular-nums desk:text-[40px]">
        {value}
      </p>
    </article>
  );
}

const typeTableCols = "desk:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)_minmax(0,0.7fr)]";

export default function Stats() {
  const orders = useAtomValue(ordersAtom);
  const visibleOrders = useAtomValue(filteredOrdersAtom);
  const dateFrom = useAtomValue(dateFromAtom);
  const dateTo = useAtomValue(dateToAtom);
  const hasActiveFilters = useAtomValue(hasActiveFiltersAtom);
  const hasDateRange = Boolean(dateFrom || dateTo);
  const typeSeconds = useAtomValue(typeSecondsAtom);
  const codeSeconds = useAtomValue(codeSecondsAtom);
  const stats = useMemo(
    () => summarizeOrders(visibleOrders, { from: dateFrom, to: dateTo }),
    [visibleOrders, dateFrom, dateTo],
  );
  const secondsByType = useMemo(
    () => sumSecondsByType(visibleOrders, typeSeconds, codeSeconds),
    [visibleOrders, typeSeconds, codeSeconds],
  );
  const employeeRows = useMemo(
    () =>
      stats.byEmployee
        .filter((item) => getEmployee(item.employeeId))
        .map((item) => {
          const theirs = visibleOrders.filter(
            (order) => (order.employeeId || "—") === item.employeeId,
          );
          return {
            ...item,
            name: getEmployeeName(item.employeeId),
            seconds: sumOrderSeconds(theirs, typeSeconds, codeSeconds),
          };
        }),
    [stats.byEmployee, visibleOrders, typeSeconds, codeSeconds],
  );
  const directoryRows = useMemo(() => {
    const byId = new Map(
      employeeRows.map((item) => [item.employeeId, item]),
    );
    return listDirectoryEmployees().map((person) => ({
      ...person,
      count: byId.get(person.employeeId)?.count ?? 0,
    }));
  }, [employeeRows]);
  const emptyMessage =
    orders.length === 0
      ? "Chưa có đơn hàng."
      : hasActiveFilters
        ? "Không có đơn khớp với bộ lọc."
        : "Chưa có đơn hàng.";

  useEffect(() => {
    document.title = "Thống kê";
    return () => {
      document.title = "Order";
    };
  }, []);

  return (
    <div className="min-h-screen bg-parchment">
      <GlobalNav />

      <main className="mx-auto max-w-[1200px] px-6 py-12 tablet:px-8 tablet:py-20">
        <h1 className="m-0 font-sans text-[34px] font-semibold leading-[1.1] tracking-[-0.01em] text-ink desk:text-[40px]">
          Thống kê.
        </h1>
        <p className="mt-4 max-w-[28ch] font-sans text-[21px] font-normal leading-[1.19] tracking-[0.196px] text-ink-muted-80 desk:text-[28px] desk:leading-[1.14]">
          Tổng quan đơn hàng đã nhập.
        </p>

        <div className="mt-8">
          <OrderFilters />
        </div>

        <section
          className="mt-8 grid grid-cols-1 gap-4 tablet:grid-cols-2 desk:grid-cols-4"
          aria-label="Chỉ số"
        >
          <MetricCard label="Đơn đã nhập" value={stats.total} />
          <MetricCard label="Mã CO" value={stats.uniqueCoCodes} />
          <MetricCard label="Mã PD" value={stats.uniquePdCodes} />
          <MetricCard
            label="Tổng số giây"
            value={formatSeconds(secondsByType.total)}
          />
        </section>

        <section
          className="mt-4 grid grid-cols-1 gap-4 desk:grid-cols-3"
          aria-label="Biểu đồ"
        >
          <ChartCard title="Tỷ lệ theo công đoạn">
            <DonutChart items={stats.byType} total={stats.total} />
          </ChartCard>
          <ChartCard
            className="desk:col-span-2"
            title={hasDateRange ? "Đơn theo ngày" : "Đơn 14 ngày gần đây"}
          >
            <DayBarChart items={stats.byDay} />
          </ChartCard>
          <ChartCard className="desk:col-span-3" title="Theo nhân viên">
            <EmployeeBarChart items={employeeRows} empty={emptyMessage} />
          </ChartCard>
        </section>

        <section className="mt-12" aria-labelledby="stats-by-type">
          <h2
            id="stats-by-type"
            className="m-0 mb-4 font-sans text-[21px] font-semibold leading-[1.19] tracking-[0.231px] text-ink"
          >
            Theo công đoạn
          </h2>
          {stats.total === 0 ? (
            <p className="m-0 text-[17px] leading-[1.44] tracking-[-0.374px] text-ink-muted-48">
              {emptyMessage}
            </p>
          ) : (
            <ul className="m-0 list-none overflow-hidden rounded-[18px] border border-hairline bg-canvas p-0">
              <li
                className={`hidden border-b border-hairline px-6 py-3 text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink-muted-48 desk:grid ${typeTableCols} desk:gap-4`}
              >
                <span>Công đoạn</span>
                <span>Đơn</span>
                <span>Số giây</span>
              </li>
              {secondsByType.items.map((item) => (
                <li
                  key={item.id}
                  className={`grid grid-cols-1 gap-y-2 px-6 py-[17px] ${typeTableCols} desk:items-center desk:gap-4 border-b border-hairline`}
                >
                  <span className="text-[17px] font-normal leading-[1.44] tracking-[-0.374px] text-ink">
                    {item.label}
                  </span>
                  <span className="text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-80 tabular-nums desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px] desk:text-ink">
                    <span className="desk:hidden">Đơn </span>
                    {item.count}
                  </span>
                  <span className="text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-80 tabular-nums desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px] desk:text-ink">
                    <span className="desk:hidden">Số giây </span>
                    {formatSeconds(item.seconds)}
                  </span>
                </li>
              ))}
              <li
                className={`grid grid-cols-1 gap-y-2 px-6 py-[17px] ${typeTableCols} desk:items-center desk:gap-4`}
              >
                <span className="text-[17px] font-semibold leading-[1.44] tracking-[-0.374px] text-ink">
                  Tổng
                </span>
                <span className="text-sm font-semibold leading-[1.43] tracking-[-0.224px] text-ink tabular-nums desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px]">
                  <span className="desk:hidden">Đơn </span>
                  {secondsByType.totalCount}
                </span>
                <span className="text-sm font-semibold leading-[1.43] tracking-[-0.224px] text-ink tabular-nums desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px]">
                  <span className="desk:hidden">Số giây </span>
                  {formatSeconds(secondsByType.total)}
                </span>
              </li>
            </ul>
          )}
        </section>

        <section className="mt-12" aria-labelledby="stats-by-employee">
          <h2
            id="stats-by-employee"
            className="m-0 mb-4 font-sans text-[21px] font-semibold leading-[1.19] tracking-[0.231px] text-ink"
          >
            Nhân viên
            {directoryRows.length ? (
              <span className="ml-2 font-normal text-ink-muted-48">
                {directoryRows.length}
              </span>
            ) : null}
          </h2>
          <EmployeeDirectory
            rows={directoryRows}
            empty="Chưa có nhân viên."
          />
        </section>
      </main>
    </div>
  );
}
