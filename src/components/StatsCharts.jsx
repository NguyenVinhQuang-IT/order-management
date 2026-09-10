const CHART_COLORS = ["#0066cc", "#1d1d1f", "#6e6e73", "#2997ff"];

function niceMax(value) {
  if (value <= 0) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const nice =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

export function ChartCard({ title, children, className = "" }) {
  return (
    <article
      className={`rounded-[18px] border border-hairline bg-canvas p-6 ${className}`}
    >
      <h2 className="mb-6 text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
        {title}
      </h2>
      {children}
    </article>
  );
}

export function DonutChart({ items, total }) {
  const size = 196;
  const cx = 98;
  const cy = 98;
  const radius = 68;
  const stroke = 18;
  const circumference = 2 * Math.PI * radius;

  const arcs = [];
  let offset = 0;
  items.forEach((item, index) => {
    const color = CHART_COLORS[index % CHART_COLORS.length];
    if (total > 0 && item.count > 0) {
      const length = (item.count / total) * circumference;
      arcs.push({ id: item.id, length, offset, color });
      offset += length;
    }
  });

  return (
    <div className="flex flex-col items-center gap-6 tablet:flex-row tablet:justify-center tablet:gap-10">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="Tỷ lệ đơn theo công đoạn"
      >
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="#f5f5f7"
          strokeWidth={stroke}
        />
        {arcs.map((arc) => (
          <circle
            key={arc.id}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={stroke}
            strokeDasharray={`${arc.length} ${circumference - arc.length}`}
            strokeDashoffset={-arc.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ))}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          fill="#1d1d1f"
          fontSize="28"
          fontWeight="600"
          fontFamily="Inter, system-ui, sans-serif"
        >
          {total}
        </text>
        <text
          x={cx}
          y={cy + 18}
          textAnchor="middle"
          fill="#7a7a7a"
          fontSize="12"
          fontFamily="Inter, system-ui, sans-serif"
        >
          đơn
        </text>
      </svg>
      <ul className="m-0 flex w-full max-w-[220px] list-none flex-col gap-3 p-0">
        {items.map((item, index) => (
          <li key={item.id} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-sm leading-[1.29] tracking-[-0.224px] text-ink">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                aria-hidden="true"
              />
              <span className="truncate">{item.label}</span>
            </span>
            <span className="text-sm leading-[1.29] tracking-[-0.224px] text-ink tabular-nums">
              {item.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DayBarChart({ items }) {
  const width = Math.max(420, items.length * 36 + 40);
  const height = 220;
  const padL = 28;
  const padR = 8;
  const padT = 12;
  const padB = 32;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const max = niceMax(Math.max(...items.map((item) => item.count), 0));
  const gap = 8;
  const barW = Math.max(14, (plotW - gap * (items.length + 1)) / items.length);
  const ticks = [0, 0.5, 1];

  return (
    <div className="overflow-x-auto">
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-label="Số đơn theo ngày"
    >
      {ticks.map((tick) => {
        const y = padT + plotH * (1 - tick);
        return (
          <g key={tick}>
            <line
              x1={padL}
              x2={width - padR}
              y1={y}
              y2={y}
              stroke="#e0e0e0"
            />
            <text
              x={padL - 6}
              y={y + 4}
              textAnchor="end"
              fill="#7a7a7a"
              fontSize="11"
              fontFamily="Inter, system-ui, sans-serif"
            >
              {Math.round(max * tick)}
            </text>
          </g>
        );
      })}
      {items.map((item, index) => {
        const heightValue = (item.count / max) * plotH;
        const x = padL + gap + index * (barW + gap);
        const y = padT + plotH - heightValue;
        return (
          <g key={item.id}>
            {item.count > 0 ? (
              <rect
                x={x}
                y={y}
                width={barW}
                height={heightValue}
                rx={6}
                fill="#0066cc"
              />
            ) : null}
            <text
              x={x + barW / 2}
              y={height - 10}
              textAnchor="middle"
              fill="#7a7a7a"
              fontSize="11"
              fontFamily="Inter, system-ui, sans-serif"
            >
              {item.label}
            </text>
          </g>
        );
      })}
    </svg>
    </div>
  );
}

export function EmployeeBarChart({ items, empty = "Chưa có dữ liệu." }) {
  const max = Math.max(...items.map((item) => item.count), 0);

  if (items.length === 0) {
    return (
      <p className="m-0 text-[17px] leading-[1.44] tracking-[-0.374px] text-ink-muted-48">
        {empty}
      </p>
    );
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-4 p-0">
      {items.map((item) => {
        const percent = max > 0 ? Math.max(6, (item.count / max) * 100) : 0;
        return (
          <li key={item.employeeId} className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-sm leading-[1.29] tracking-[-0.224px] text-ink tabular-nums">
              {item.employeeId}
            </span>
            <div className="h-3 min-w-0 flex-1 rounded-full bg-parchment">
              <div
                className="h-3 rounded-full bg-primary"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="w-8 shrink-0 text-right text-sm leading-[1.29] tracking-[-0.224px] text-ink tabular-nums">
              {item.count}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
