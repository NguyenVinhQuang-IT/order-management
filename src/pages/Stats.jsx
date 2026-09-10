import { useEffect, useMemo } from "react";
import { useAtomValue } from "jotai";
import DateRangeFilter from "../components/DateRangeFilter";
import GlobalNav from "../components/GlobalNav";
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
  ordersAtom,
  summarizeOrders,
} from "../orders";

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

function StatList({ id, title, items, empty }) {
  return (
    <section className="mt-12" aria-labelledby={id}>
      <h2
        id={id}
        className="m-0 mb-4 font-sans text-[21px] font-semibold leading-[1.19] tracking-[0.231px] text-ink"
      >
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="m-0 text-[17px] leading-[1.44] tracking-[-0.374px] text-ink-muted-48">
          {empty}
        </p>
      ) : (
        <ul className="m-0 list-none overflow-hidden rounded-[18px] border border-hairline bg-canvas p-0">
          {items.map((item, index) => (
            <li
              key={item.id}
              className={`flex items-baseline justify-between gap-4 px-6 py-[17px] ${
                index < items.length - 1 ? "border-b border-hairline" : ""
              }`}
            >
              <span className="text-[17px] font-normal leading-[1.44] tracking-[-0.374px] text-ink">
                {item.label}
              </span>
              <span className="text-[17px] font-normal leading-[1.44] tracking-[-0.374px] text-ink tabular-nums">
                {item.value}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function Stats() {
  const orders = useAtomValue(ordersAtom);
  const visibleOrders = useAtomValue(filteredOrdersAtom);
  const dateFrom = useAtomValue(dateFromAtom);
  const dateTo = useAtomValue(dateToAtom);
  const hasDateRange = Boolean(dateFrom || dateTo);
  const stats = useMemo(
    () => summarizeOrders(visibleOrders, { from: dateFrom, to: dateTo }),
    [visibleOrders, dateFrom, dateTo],
  );
  const emptyMessage =
    orders.length === 0
      ? "Chưa có đơn hàng."
      : hasDateRange
        ? "Không có đơn trong khoảng ngày đã chọn."
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
          <DateRangeFilter />
        </div>

        <section
          className="mt-8 grid grid-cols-1 gap-4 tablet:grid-cols-2 desk:grid-cols-4"
          aria-label="Chỉ số"
        >
          <MetricCard label="Đơn đã nhập" value={stats.total} />
          <MetricCard label="Mã CO" value={stats.uniqueCodes} />
          <MetricCard label="Số giây" value="—" />
          <MetricCard label="Tổng CO" value="—" />
        </section>

        <section
          className="mt-4 grid grid-cols-1 gap-4 desk:grid-cols-2"
          aria-label="Biểu đồ"
        >
          <ChartCard title="Tỷ lệ theo công đoạn">
            <DonutChart items={stats.byType} total={stats.total} />
          </ChartCard>
          <ChartCard title={hasDateRange ? "Đơn theo ngày" : "Đơn 7 ngày gần đây"}>
            <DayBarChart items={stats.byDay} />
          </ChartCard>
          <ChartCard className="desk:col-span-2" title="Theo nhân viên">
            <EmployeeBarChart items={stats.byEmployee} empty={emptyMessage} />
          </ChartCard>
        </section>

        <StatList
          id="stats-by-type"
          title="Theo công đoạn"
          empty={emptyMessage}
          items={
            stats.total
              ? stats.byType.map((item) => ({
                  id: item.id,
                  label: item.label,
                  value: item.count,
                }))
              : []
          }
        />

        <StatList
          id="stats-by-employee"
          title="Theo nhân viên"
          empty={emptyMessage}
          items={stats.byEmployee.map((item) => ({
            id: item.employeeId,
            label: item.employeeId,
            value: item.count,
          }))}
        />
      </main>
    </div>
  );
}
