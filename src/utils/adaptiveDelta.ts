```ts
export interface LotteryRow {
  draw_date: string;
  top3: string;
}

export interface PredictionResult {
  hundreds: number[];
  tens: number[];
  units: number[];
}

function top5(values: number[]) {
  const freq: Record<number, number> = {};

  values.forEach((v) => {
    freq[v] = (freq[v] || 0) + 1;
  });

  return Object.entries(freq)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 5)
    .map((x) => Number(x[0]));
}

export function adaptiveHybridDelta(
  rows: LotteryRow[]
): PredictionResult {
  const deltaH: number[] = [];
  const deltaT: number[] = [];
  const deltaU: number[] = [];

  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1].top3.padStart(3, "0");
    const curr = rows[i].top3.padStart(3, "0");

    deltaH.push(
      (Number(curr[0]) - Number(prev[0]) + 10) % 10
    );

    deltaT.push(
      (Number(curr[1]) - Number(prev[1]) + 10) % 10
    );

    deltaU.push(
      (Number(curr[2]) - Number(prev[2]) + 10) % 10
    );
  }

  const topH = top5(deltaH);
  const topT = top5(deltaT);
  const topU = top5(deltaU);

  const latest =
    rows[rows.length - 1].top3.padStart(3, "0");

  const latestH = Number(latest[0]);
  const latestT = Number(latest[1]);
  const latestU = Number(latest[2]);

  return {
    hundreds: topH.map((d) => (latestH + d) % 10),
    tens: topT.map((d) => (latestT + d) % 10),
    units: topU.map((d) => (latestU + d) % 10),
  };
}
```
