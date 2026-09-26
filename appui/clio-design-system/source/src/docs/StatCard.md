# StatCard

Metric card: icon title, big number, delta and an optional bar chart (`BarChart` is exported too). Also exports `CardTitle`.

## Props

`icon` · `title` · `value` · `unit` · `delta` · `deltaLabel` · `chart` {data, labels, active, average, tip}.

## Usage

- One highlighted bar (today/selected) in `accent`; the rest are `chart-bar`.
- Only chart data Clio already records (tasks done, notes logged, Kanban progress).
