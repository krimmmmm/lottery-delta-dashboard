import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

function pad3(value) {
  return String(value ?? "").padStart(3, "0").slice(-3);
}

function mod10(n) {
  return ((n % 10) + 10) % 10;
}

function delta(a, b) {
  return mod10(Number(b) - Number(a));
}

function top5ByPosition(rowsAsc, position) {
  const score = {};

  for (let i = 1; i < rowsAsc.length; i++) {
    const prev = pad3(rowsAsc[i - 1].top3);
    const curr = pad3(rowsAsc[i].top3);
    const d = delta(prev[position], curr[position]);

    if (!score[d]) score[d] = 0;

    score[d] += 4;
    score[d] += (i / rowsAsc.length) * 3;

    if (d <= 3 || d >= 7) score[d] += 2;
    if (prev[position] === curr[position]) score[d] += 1;
  }

  return Object.entries(score)
    .sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]))
    .slice(0, 5)
    .map(([d]) => Number(d));
}

function predictSet(fromDigit, deltas) {
  return deltas.map((d) => mod10(Number(fromDigit) + d));
}

export default function App() {
  const [draws, setDraws] = useState([]);
  const [latestInput, setLatestInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setErrorText("");

    const { data, error } = await supabase
      .from("lottery_draws")
      .select("id, draw_date, year_th, first_prize, top3")
      .order("draw_date", { ascending: true });

    console.log("lottery_draws data:", data);
    console.log("lottery_draws error:", error);

    if (error) {
      setErrorText(error.message || "ไม่สามารถโหลดข้อมูลจาก Supabase ได้");
      setDraws([]);
      setLoading(false);
      return;
    }

    const cleanRows = (data || [])
      .filter((r) => r.draw_date && r.top3)
      .map((r) => ({ ...r, top3: pad3(r.top3) }));

    setDraws(cleanRows);

    if (cleanRows.length > 0) {
      setLatestInput(cleanRows[cleanRows.length - 1].top3);
    }

    setLoading(false);
  }

  const analysis = useMemo(() => {
    if (draws.length < 2) {
      return {
        nextH: [],
        nextT: [],
        nextU: [],
        backtest: [],
        hitRate: 0,
        hitCount: 0,
        totalCount: 0,
        acc: [0, 0, 0],
      };
    }

    const trainRows = draws.slice(-48);

    const hDelta = top5ByPosition(trainRows, 0);
    const tDelta = top5ByPosition(trainRows, 1);
    const uDelta = top5ByPosition(trainRows, 2);

    const latest = pad3(latestInput || trainRows[trainRows.length - 1].top3);

    const nextH = predictSet(latest[0], hDelta);
    const nextT = predictSet(latest[1], tDelta);
    const nextU = predictSet(latest[2], uDelta);

    const displayRows = draws.slice(-24);

    const rows = [];
    let hitCount = 0;
    let totalCount = 0;
    const posHit = [0, 0, 0];
    const posTotal = [0, 0, 0];

    for (let i = 1; i < displayRows.length; i++) {
      const prev = displayRows[i - 1];
      const curr = displayRows[i];

      const from = pad3(prev.top3);
      const to = pad3(curr.top3);

      const predH = predictSet(from[0], hDelta);
      const predT = predictSet(from[1], tDelta);
      const predU = predictSet(from[2], uDelta);

      const hOk = predH.includes(Number(to[0]));
      const tOk = predT.includes(Number(to[1]));
      const uOk = predU.includes(Number(to[2]));

      const oks = [hOk, tOk, uOk];

      oks.forEach((ok, idx) => {
        totalCount++;
        posTotal[idx]++;
        if (ok) {
          hitCount++;
          posHit[idx]++;
        }
      });

      rows.push({
        date: curr.draw_date,
        transition: `${from} → ${to}`,
        actual: to,
        predH,
        predT,
        predU,
        hOk,
        tOk,
        uOk,
        score: oks.filter(Boolean).length,
      });
    }

    return {
      nextH,
      nextT,
      nextU,
      backtest: rows,
      hitRate: totalCount ? Math.round((hitCount / totalCount) * 100) : 0,
      hitCount,
      totalCount,
      acc: posTotal.map((t, i) => (t ? Math.round((posHit[i] / t) * 100) : 0)),
    };
  }, [draws, latestInput]);

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Adaptive Hybrid Delta Dashboard v7</h1>

      {loading && <div style={styles.notice}>Loading data from Supabase...</div>}

      {errorText && (
        <div style={styles.errorBox}>
          <b>Supabase Error:</b> {errorText}
          <br />
          กรุณาตรวจสอบ Supabase Key, Table name และ RLS Policy
        </div>
      )}

      {!loading && !errorText && draws.length === 0 && (
        <div style={styles.errorBox}>ไม่พบข้อมูลในตาราง <b>lottery_draws</b></div>
      )}

      <div style={styles.grid4}>
        <Card title="Training Window" value="24 เดือน" sub="ใช้ 48 งวดล่าสุดโดยประมาณ" />
        <Card title="Backtest Display" value="12 เดือน" sub="แสดง 24 งวดล่าสุดโดยประมาณ" />
        <Card title="Coverage" value="5 ตัว/หลัก" sub="Top-5 Dynamic" />
        <Card title="Total Sets" value="125" sub="5 × 5 × 5" />
      </div>

      <div style={styles.grid4}>
        <div style={styles.cardBlue}>
          <h2 style={styles.cardTitle}>กรอกเลข 3 ตัวล่าสุด</h2>
          <input
            value={latestInput}
            maxLength={3}
            onChange={(e) => setLatestInput(e.target.value.replace(/\D/g, "").slice(0, 3))}
            style={styles.input}
            placeholder="เช่น 770"
          />
          <div style={styles.subText}>ใช้เป็นฐาน From เพื่อวิเคราะห์ช่วงถัดไป</div>
        </div>

        <Card title="หลักร้อย งวดถัดไป" value={analysis.nextH.join(",") || "-"} />
        <Card title="หลักสิบ งวดถัดไป" value={analysis.nextT.join(",") || "-"} />
        <Card title="หลักหน่วย งวดถัดไป" value={analysis.nextU.join(",") || "-"} />
      </div>

      <div style={styles.grid4}>
        <Card title="Hit Rate" value={`${analysis.hitRate}%`} sub={`${analysis.hitCount}/${analysis.totalCount} หลัก`} />
        <Card title="หลักร้อย Accuracy" value={`${analysis.acc[0]}%`} />
        <Card title="หลักสิบ Accuracy" value={`${analysis.acc[1]}%`} />
        <Card title="หลักหน่วย Accuracy" value={`${analysis.acc[2]}%`} />
      </div>

      <button onClick={loadData} style={styles.button}>Reload Data</button>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>งวดวันที่</th>
              <th style={styles.th}>Transition</th>
              <th style={styles.th}>เลขจริง</th>
              <th style={styles.th}>Pred H</th>
              <th style={styles.th}>Hit H</th>
              <th style={styles.th}>Pred T</th>
              <th style={styles.th}>Hit T</th>
              <th style={styles.th}>Pred U</th>
              <th style={styles.th}>Hit U</th>
              <th style={styles.th}>Result</th>
            </tr>
          </thead>
          <tbody>
            {analysis.backtest.map((r, idx) => (
              <tr key={`${r.date}-${idx}`}>
                <td style={styles.td}>{r.date}</td>
                <td style={styles.td}>{r.transition}</td>
                <td style={styles.td}>{r.actual}</td>
                <td style={styles.pred}>{r.predH.join(",")}</td>
                <td style={r.hOk ? styles.hit : styles.miss}>{r.hOk ? "เข้า" : "ไม่เข้า"}</td>
                <td style={styles.pred}>{r.predT.join(",")}</td>
                <td style={r.tOk ? styles.hit : styles.miss}>{r.tOk ? "เข้า" : "ไม่เข้า"}</td>
                <td style={styles.pred}>{r.predU.join(",")}</td>
                <td style={r.uOk ? styles.hit : styles.miss}>{r.uOk ? "เข้า" : "ไม่เข้า"}</td>
                <td style={styles.td}><b>{r.score}/3</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={styles.sectionTitle}>ข้อมูลทั้งหมดจาก Database</h2>
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Date</th>
              <th style={styles.th}>Year</th>
              <th style={styles.th}>1st Prize</th>
              <th style={styles.th}>Top3</th>
            </tr>
          </thead>
          <tbody>
            {[...draws].reverse().map((item) => (
              <tr key={item.id || item.draw_date}>
                <td style={styles.td}>{item.draw_date}</td>
                <td style={styles.td}>{item.year_th}</td>
                <td style={styles.td}>{item.first_prize}</td>
                <td style={styles.td}>{item.top3}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ title, value, sub }) {
  return (
    <div style={styles.card}>
      <h2 style={styles.cardTitle}>{title}</h2>
      <div style={styles.big}>{value}</div>
      {sub && <div style={styles.subText}>{sub}</div>}
    </div>
  );
}

const styles = {
  page: { padding: "24px", fontFamily: "Arial, Tahoma, sans-serif", background: "#0f172a", minHeight: "100vh", color: "white" },
  title: { color: "#fbbf24", fontSize: "36px", margin: "0 0 18px" },
  notice: { background: "#1e293b", border: "1px solid #334155", padding: "12px", borderRadius: "10px", marginBottom: "16px" },
  errorBox: { background: "#3f1d1d", color: "#fecaca", border: "1px solid #ef4444", padding: "14px", borderRadius: "10px", marginBottom: "16px" },
  grid4: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", marginBottom: "16px" },
  card: { background: "#111827", border: "1px solid #374151", borderRadius: "14px", padding: "16px" },
  cardBlue: { background: "#111827", border: "1px solid #38bdf8", borderRadius: "14px", padding: "16px" },
  cardTitle: { color: "#fbbf24", fontSize: "16px", margin: "0 0 8px" },
  big: { fontSize: "30px", color: "#fbbf24", fontWeight: "bold", wordBreak: "break-word" },
  subText: { color: "#cbd5e1", fontSize: "12px", marginTop: "4px" },
  input: { width: "100%", padding: "10px", borderRadius: "10px", border: "1px solid #334155", background: "#020617", color: "white", textAlign: "center", fontSize: "24px", fontWeight: "bold", letterSpacing: "3px" },
  button: { background: "#f59e0b", border: "none", borderRadius: "8px", padding: "10px 16px", fontWeight: "bold", cursor: "pointer", marginBottom: "16px" },
  sectionTitle: { color: "#fbbf24", marginTop: "24px" },
  tableWrap: { overflowX: "auto", border: "1px solid #374151", borderRadius: "12px", marginTop: "12px" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: "1050px", background: "#111827" },
  th: { border: "1px solid #374151", padding: "10px", background: "#f59e0b", color: "black", textAlign: "center" },
  td: { border: "1px solid #374151", padding: "9px", textAlign: "center" },
  pred: { border: "1px solid #374151", padding: "9px", textAlign: "center", color: "#fde68a" },
  hit: { border: "1px solid #374151", padding: "9px", textAlign: "center", color: "#22c55e", fontWeight: "bold" },
  miss: { border: "1px solid #374151", padding: "9px", textAlign: "center", color: "#ef4444", fontWeight: "bold" },
};
