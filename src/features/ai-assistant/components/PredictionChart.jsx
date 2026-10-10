const WIDTH = 640;
const HEIGHT = 360;
const PLOT = { left: 72, right: 620, top: 42, bottom: 270 };

function parseChart(raw) {
  try {
    const chart = JSON.parse(raw);
    if (
      !chart
      || !['bar', 'line'].includes(chart.type)
      || typeof chart.title !== 'string'
      || chart.title.length > 160
      || (chart.x_label != null && (typeof chart.x_label !== 'string' || chart.x_label.length > 60))
      || (chart.y_label != null && (typeof chart.y_label !== 'string' || chart.y_label.length > 60))
      || !Array.isArray(chart.data)
      || chart.data.length < 2
      || chart.data.length > 20
      || chart.data.some((point) => (
        !point
        || typeof point.label !== 'string'
        || !point.label.trim()
        || point.label.length > 60
        || typeof point.value !== 'number'
        || !Number.isFinite(point.value)
        || Math.abs(point.value) > 1_000_000_000_000
      ))
    ) return null;
    return chart;
  } catch {
    return null;
  }
}

export default function PredictionChart({ source }) {
  const chart = parseChart(source);
  if (!chart) {
    return <pre className="prediction-chart__invalid"><code>{source}</code></pre>;
  }

  const values = chart.data.map((point) => point.value);
  const rawMin = Math.min(0, ...values);
  const rawMax = Math.max(0, ...values);
  const padding = (rawMax - rawMin || 1) * 0.08;
  const min = rawMin < 0 ? rawMin - padding : 0;
  const max = rawMax > 0 ? rawMax + padding : 1;
  const xStep = (PLOT.right - PLOT.left) / chart.data.length;
  const y = (value) => PLOT.bottom - ((value - min) / (max - min)) * (PLOT.bottom - PLOT.top);
  const ticks = Array.from({ length: 5 }, (_, index) => min + ((max - min) * index) / 4);
  const points = chart.data.map((point, index) => ({
    x: PLOT.left + xStep * (index + 0.5),
    y: y(point.value),
    ...point,
  }));

  return (
    <figure className="prediction-chart" aria-label={chart.title}>
      <figcaption>{chart.title}</figcaption>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`${chart.type} chart: ${chart.title}`}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={PLOT.left} x2={PLOT.right} y1={y(tick)} y2={y(tick)} className="prediction-chart__gridline" />
            <text x={PLOT.left - 10} y={y(tick) + 4} textAnchor="end" className="prediction-chart__tick">
              {Number(tick.toPrecision(3)).toLocaleString()}
            </text>
          </g>
        ))}
        <line x1={PLOT.left} x2={PLOT.left} y1={PLOT.top} y2={PLOT.bottom} className="prediction-chart__axis" />
        <line x1={PLOT.left} x2={PLOT.right} y1={PLOT.bottom} y2={PLOT.bottom} className="prediction-chart__axis" />
        {chart.type === 'bar' ? points.map((point) => {
          const zeroY = y(0);
          return (
            <rect
              key={point.label}
              x={point.x - xStep * 0.28}
              y={Math.min(point.y, zeroY)}
              width={xStep * 0.56}
              height={Math.max(1, Math.abs(zeroY - point.y))}
              rx="4"
              className="prediction-chart__bar"
            >
              <title>{`${point.label}: ${point.value.toLocaleString()}`}</title>
            </rect>
          );
        }) : (
          <>
            <polyline
              points={points.map((point) => `${point.x},${point.y}`).join(' ')}
              className="prediction-chart__line"
            />
            {points.map((point) => (
              <circle key={point.label} cx={point.x} cy={point.y} r="5" className="prediction-chart__point">
                <title>{`${point.label}: ${point.value.toLocaleString()}`}</title>
              </circle>
            ))}
          </>
        )}
        {points.map((point) => (
          <text
            key={point.label}
            x={point.x}
            y={PLOT.bottom + 22}
            textAnchor="end"
            transform={`rotate(-28 ${point.x} ${PLOT.bottom + 22})`}
            className="prediction-chart__tick"
          >
            {point.label.length > 18 ? `${point.label.slice(0, 17)}…` : point.label}
          </text>
        ))}
        {chart.y_label && (
          <text
            x="18"
            y={(PLOT.top + PLOT.bottom) / 2}
            textAnchor="middle"
            transform={`rotate(-90 18 ${(PLOT.top + PLOT.bottom) / 2})`}
            className="prediction-chart__label"
          >
            {chart.y_label}
          </text>
        )}
        {chart.x_label && (
          <text x={(PLOT.left + PLOT.right) / 2} y={HEIGHT - 10} textAnchor="middle" className="prediction-chart__label">
            {chart.x_label}
          </text>
        )}
      </svg>
      <p>Illustrative values from the assistant response; verify assumptions and source data.</p>
    </figure>
  );
}
