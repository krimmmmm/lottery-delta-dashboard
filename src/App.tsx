```tsx
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import {
  adaptiveHybridDelta,
  LotteryRow,
} from "./utils/adaptiveDelta";

function App() {
  const [rows, setRows] = useState<LotteryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data } = await supabase
      .from("lottery_draws")
      .select("*")
      .order("draw_date", {
        ascending: true,
      });

    if (data) {
      setRows(data);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <div
        style={{
          padding: 40,
          color: "white",
          background: "#061326",
          minHeight: "100vh",
        }}
      >
        Loading...
      </div>
    );
  }

  const result =
    adaptiveHybridDelta(rows);

  return (
    <div
      style={{
        background: "#061326",
        color: "white",
        minHeight: "100vh",
        padding: 30,
        fontFamily: "Arial",
      }}
    >
      <h1>
        Adaptive Hybrid Delta Dashboard v7
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(3,1fr)",
          gap: 20,
          marginTop: 30,
        }}
      >
        <div
          style={{
            background: "#0b1d35",
            padding: 20,
            borderRadius: 12,
          }}
        >
          <h2>หลักร้อย Top-5</h2>
          <h1>
            {result.hundreds.join(",")}
          </h1>
        </div>

        <div
          style={{
            background: "#0b1d35",
            padding: 20,
            borderRadius: 12,
          }}
        >
          <h2>หลักสิบ Top-5</h2>
          <h1>
            {result.tens.join(",")}
          </h1>
        </div>

        <div
          style={{
            background: "#0b1d35",
            padding: 20,
            borderRadius: 12,
          }}
        >
          <h2>หลักหน่วย Top-5</h2>
          <h1>
            {result.units.join(",")}
          </h1>
        </div>
      </div>

      <table
        style={{
          width: "100%",
          marginTop: 40,
          borderCollapse: "collapse",
        }}
      >
        <thead>
          <tr
            style={{
              background: "#f5a000",
              color: "black",
            }}
          >
            <th>งวดวันที่</th>
            <th>3 ตัวบน</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r) => (
            <tr key={r.draw_date}>
              <td
                style={{
                  padding: 10,
                  borderBottom:
                    "1px solid #1e3354",
                }}
              >
                {r.draw_date}
              </td>

              <td
                style={{
                  padding: 10,
                  borderBottom:
                    "1px solid #1e3354",
                }}
              >
                {r.top3}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
```
