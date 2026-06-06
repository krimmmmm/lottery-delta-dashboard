import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

const APP_USERNAME = "admin";
const APP_PASSWORD = "123456789";

const matrixColors = [
  "#7f1d1d",
  "#78350f",
  "#14532d",
  "#1e3a8a",
  "#4c1d95",
  "#831843",
  "#0f766e",
  "#374151",
  "#365314",
  "#92400e",
  "#1d4ed8",
  "#6d28d9",
  "#be185d",
];

function pad3(value) {
  return String(value ?? "").padStart(3, "0").slice(-3);
}

function mod10(n) {
  return ((n % 10) + 10) % 10;
}

function delta(a, b) {
  return mod10(Number(b) - Number(a));
}

function scoreByPosition(rowsAsc, position) {
  const score = {};
  const maxIndex = Math.max(rowsAsc.length - 1, 1);

  for (let i = 1; i < rowsAsc.length; i++) {
    const prev = pad3(rowsAsc[i - 1].top3);
    const curr = pad3(rowsAsc[i].top3);
    const d = delta(prev[position], curr[position]);

    if (!score[d]) score[d] = 0;

    score[d] += 4;
    score[d] += (i / maxIndex) * 3;
    if (d <= 3 || d >= 7) score[d] += 2;
    if (prev[position] === curr[position]) score[d] += 1;
  }

  return Object.entries(score)
    .map(([d, s]) => ({
      delta: Number(d),
      score: Number(s),
    }))
    .sort((a, b) => b.score - a.score || a.delta - b.delta);
}

function predictSet(fromDigit, deltas) {
  return deltas.map((d) => mod10(Number(fromDigit) + d));
}

function confidenceFromScores(scored, n = 2) {
  const total = scored.reduce((sum, item) => sum + item.score, 0);
  const top = scored.slice(0, n).reduce((sum, item) => sum + item.score, 0);
  return total ? Math.round((top / total) * 100) : 0;
}

function buildCombinations(h, t, u) {
  const result = [];
  h.forEach((a) => {
    t.forEach((b) => {
      u.forEach((c) => {
        result.push(`${a}${b}${c}`);
      });
    });
  });
  return result;
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    localStorage.getItem("lottery_dashboard_login") === "yes"
  );
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");

  const [draws, setDraws] = useState([]);
  const [latestInput, setLatestInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    if (isLoggedIn) loadData();
  }, [isLoggedIn]);

  function handleLogin(e) {
    e.preventDefault();

    if (loginUser === APP_USERNAME && loginPass === APP_PASSWORD) {
      localStorage.setItem("lottery_dashboard_login", "yes");
      setIsLoggedIn(true);
      setLoginError("");
      return;
    }

    setLoginError("Username หรือ Password ไม่ถูกต้อง");
  }

  function logout() {
    localStorage.removeItem("lottery_dashboard_login");
    setIsLoggedIn(false);
    setLoginUser("");
    setLoginPass("");
  }

  async function loadData() {
    setLoading(true);
    setErrorText("");

    const { data, error } = await supabase
      .from("lottery_draws")
      .select("id, draw_date, year_th, first_prize, top3")
      .order("draw_date", { ascending: true });

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
        coreH: [],
        coreT: [],
        coreU: [],
        core8: [],
        all125: [],
        confidence: [0, 0, 0],
        backtest: [],
        hitRate: 0,
        hitCount: 0,
        totalCount: 0,
        acc: [0, 0, 0],
      };
    }

    const trainRows = draws.slice(-48);

    const hScores = scoreByPosition(trainRows, 0);
    const tScores = scoreByPosition(trainRows, 1);
    const uScores = scoreByPosition(trainRows, 2);

    const hDelta5 = hScores.slice(0, 5).map((x) => x.delta);
    const tDelta5 = tScores.slice(0, 5).map((x) => x.delta);
    const uDelta5 = uScores.slice(0, 5).map((x) => x.delta);

    const hDelta2 = hScores.slice(0, 2).map((x) => x.delta);
    const tDelta2 = tScores.slice(0, 2).map((x) => x.delta);
    const uDelta2 = uScores.slice(0, 2).map((x) => x.delta);

    const latest = pad3(latestInput || trainRows[trainRows.length - 1].top3);

    const nextH = predictSet(latest[0], hDelta5);
    const nextT = predictSet(latest[1], tDelta5);
    const nextU = predictSet(latest[2], uDelta5);

    const coreH = predictSet(latest[0], hDelta2);
    const coreT = predictSet(latest[1], tDelta2);
    const coreU = predictSet(latest[2], uDelta2);

    const core8 = buildCombinations(coreH, coreT, coreU);
    const all125 = buildCombinations(nextH, nextT, nextU);

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

      const predH = predictSet(from[0], hDelta5);
      const predT = predictSet(from[1], tDelta5);
      const predU = predictSet(from[2], uDelta5);

      const corePredH = predictSet(from[0], hDelta2);
      const corePredT = predictSet(from[1], tDelta2);
      const corePredU = predictSet(from[2], uDelta2);

      const hOk = predH.includes(Number(to[0]));
      const tOk = predT.includes(Number(to[1]));
      const uOk = predU.includes(Number(to[2]));

      const hCoreOk = corePredH.includes(Number(to[0]));
      const tCoreOk = corePredT.includes(Number(to[1]));
      const uCoreOk = corePredU.includes(Number(to[2]));

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
        corePredH,
        corePredT,
        corePredU,
        hOk,
        tOk,
        uOk,
        hCoreOk,
        tCoreOk,
        uCoreOk,
        score: oks.filter(Boolean).length,
        coreScore: [hCoreOk, tCoreOk, uCoreOk].filter(Boolean).length,
      });
    }

    return {
      nextH,
      nextT,
      nextU,
      coreH,
      coreT,
      coreU,
      core8,
      all125,
      confidence: [
        confidenceFromScores(hScores, 2),
        confidenceFromScores(tScores, 2),
        confidenceFromScores(uScores, 2),
      ],
      backtest: rows,
      hitRate: totalCount ? Math.round((hitCount / totalCount) * 100) : 0,
      hitCount,
      totalCount,
      acc: posTotal.map((t, i) => (t ? Math.round((posHit[i] / t) * 100) : 0)),
    };
  }, [draws, latestInput]);

  if (!isLoggedIn) {
    return (
      <div style={styles.loginPage}>
        <form onSubmit={handleLogin} style={styles.loginBox}>
          <h1 style={styles.loginTitle}>Lottery Delta Dashboard</h1>
          <div style={styles.loginSub}>Private Access</div>

          <label style={styles.label}>Username</label>
          <input
            value={loginUser}
            onChange={(e) => setLoginUser(e.target.value)}
            style={styles.loginInput}
            placeholder="Username"
          />

          <label style={styles.label}>Password</label>
          <input
            value={loginPass}
            onChange={(e) => setLoginPass(e.target.value)}
            style={styles.loginInput}
            type="password"
            placeholder="Password"
          />

          {loginError && <div style={styles.loginError}>{loginError}</div>}

          <button type="submit" style={styles.loginButton}>Login</button>

          <div style={styles.loginHint}>Default: admin / 123456789</div>
        </form>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.headerRow}>
        <h1 style={styles.title}>Adaptive Hybrid Delta Dashboard v8</h1>
        <button onClick={logout} style={styles.logoutButton}>Logout</button>
      </div>

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

        <Card title="หลักร้อย Top-5" value={analysis.nextH.join(",") || "-"} />
        <Card title="หลักสิบ Top-5" value={analysis.nextT.join(",") || "-"} />
        <Card title="หลักหน่วย Top-5" value={analysis.nextU.join(",") || "-"} />
      </div>

      <h2 style={styles.sectionTitle}>High Confidence Top-2 Core Signal</h2>
      <div style={styles.grid4}>
        <Card title="หลักร้อย เด่น 2 ตัว" value={analysis.coreH.join(",") || "-"} sub={`Confidence ${analysis.confidence[0]}%`} />
        <Card title="หลักสิบ เด่น 2 ตัว" value={analysis.coreT.join(",") || "-"} sub={`Confidence ${analysis.confidence[1]}%`} />
        <Card title="หลักหน่วย เด่น 2 ตัว" value={analysis.coreU.join(",") || "-"} sub={`Confidence ${analysis.confidence[2]}%`} />
        <Card title="Core 8 Sets" value="8 ชุด" sub="Top-2 × Top-2 × Top-2" />
      </div>

      <div style={styles.coreBox}>
        {analysis.core8.map((n) => (
          <span key={n} style={styles.coreChip}>{n}</span>
        ))}
      </div>

      <div style={styles.grid4}>
        <Card title="Hit Rate Top-5" value={`${analysis.hitRate}%`} sub={`${analysis.hitCount}/${analysis.totalCount} หลัก`} />
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
              <th style={styles.th}>Pred H Top-5</th>
              <th style={styles.th}>Hit H</th>
              <th style={styles.th}>Core H Top-2</th>
              <th style={styles.th}>Pred T Top-5</th>
              <th style={styles.th}>Hit T</th>
              <th style={styles.th}>Core T Top-2</th>
              <th style={styles.th}>Pred U Top-5</th>
              <th style={styles.th}>Hit U</th>
              <th style={styles.th}>Core U Top-2</th>
              <th style={styles.th}>Top-5 Result</th>
              <th style={styles.th}>Core Result</th>
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
                <td style={r.hCoreOk ? styles.coreHit : styles.coreMiss}>{r.corePredH.join(",")}</td>
                <td style={styles.pred}>{r.predT.join(",")}</td>
                <td style={r.tOk ? styles.hit : styles.miss}>{r.tOk ? "เข้า" : "ไม่เข้า"}</td>
                <td style={r.tCoreOk ? styles.coreHit : styles.coreMiss}>{r.corePredT.join(",")}</td>
                <td style={styles.pred}>{r.predU.join(",")}</td>
                <td style={r.uOk ? styles.hit : styles.miss}>{r.uOk ? "เข้า" : "ไม่เข้า"}</td>
                <td style={r.uCoreOk ? styles.coreHit : styles.coreMiss}>{r.corePredU.join(",")}</td>
                <td style={styles.td}><b>{r.score}/3</b></td>
                <td style={styles.td}><b>{r.coreScore}/3</b></td>
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

      <h2 style={styles.sectionTitle}>125 Combination Matrix</h2>
      <div style={styles.matrixWrap}>
        <table style={styles.matrixTable}>
          <thead>
            <tr>
              <th style={styles.matrixHeader}>ลำดับ</th>
              {Array.from({ length: 13 }).map((_, i) => (
                <th
                  key={i}
                  style={{
                    ...styles.matrixHeader,
                    background: matrixColors[i % matrixColors.length],
                  }}
                >
                  ชุดที่ {i + 1}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {Array.from({ length: 10 }).map((_, rowIndex) => (
              <tr key={rowIndex}>
                <td style={styles.matrixIndex}>{rowIndex + 1}</td>

                {Array.from({ length: 13 }).map((_, colIndex) => {
                  const idx = rowIndex * 13 + colIndex;

                  return (
                    <td
                      key={colIndex}
                      style={{
                        ...styles.matrixCell,
                        background: matrixColors[colIndex % matrixColors.length],
                      }}
                    >
                      {analysis.all125[idx] || "-"}
                    </td>
                  );
                })}
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
  loginPage: { minHeight: "100vh", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: "Arial, Tahoma, sans-serif", padding: "24px" },
  loginBox: { width: "100%", maxWidth: "420px", background: "#111827", border: "1px solid #374151", borderRadius: "18px", padding: "28px", boxShadow: "0 20px 60px rgba(0,0,0,.35)" },
  loginTitle: { color: "#fbbf24", margin: "0 0 4px", fontSize: "30px" },
  loginSub: { color: "#cbd5e1", marginBottom: "20px" },
  label: { display: "block", color: "#fbbf24", fontWeight: "bold", margin: "12px 0 6px" },
  loginInput: { width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #334155", background: "#020617", color: "white", fontSize: "16px" },
  loginButton: { width: "100%", marginTop: "18px", background: "#f59e0b", color: "black", border: "none", borderRadius: "10px", padding: "12px", fontWeight: "bold", cursor: "pointer", fontSize: "16px" },
  loginError: { background: "#3f1d1d", border: "1px solid #ef4444", color: "#fecaca", borderRadius: "8px", padding: "10px", marginTop: "12px" },
  loginHint: { color: "#94a3b8", fontSize: "12px", marginTop: "14px", textAlign: "center" },
  page: { padding: "24px", fontFamily: "Arial, Tahoma, sans-serif", background: "#0f172a", minHeight: "100vh", color: "white" },
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" },
  title: { color: "#fbbf24", fontSize: "36px", margin: "0 0 18px" },
  logoutButton: { background: "#334155", color: "white", border: "1px solid #64748b", borderRadius: "8px", padding: "9px 14px", cursor: "pointer", fontWeight: "bold" },
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
  coreBox: { background: "#111827", border: "1px solid #374151", borderRadius: "14px", padding: "16px", marginBottom: "16px" },
  coreChip: { display: "inline-block", background: "#020617", border: "1px solid #f59e0b", color: "#fde68a", borderRadius: "999px", padding: "8px 14px", margin: "5px", fontSize: "18px", fontWeight: "bold" },
  tableWrap: { overflowX: "auto", border: "1px solid #374151", borderRadius: "12px", marginTop: "12px" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: "1450px", background: "#111827" },
  th: { border: "1px solid #374151", padding: "10px", background: "#f59e0b", color: "black", textAlign: "center" },
  td: { border: "1px solid #374151", padding: "9px", textAlign: "center" },
  pred: { border: "1px solid #374151", padding: "9px", textAlign: "center", color: "#fde68a" },
  hit: { border: "1px solid #374151", padding: "9px", textAlign: "center", color: "#22c55e", fontWeight: "bold" },
  miss: { border: "1px solid #374151", padding: "9px", textAlign: "center", color: "#ef4444", fontWeight: "bold" },
  coreHit: { border: "1px solid #374151", padding: "9px", textAlign: "center", color: "#38bdf8", fontWeight: "bold" },
  coreMiss: { border: "1px solid #374151", padding: "9px", textAlign: "center", color: "#94a3b8", fontWeight: "bold" },
  matrixWrap: { overflowX: "auto", border: "1px solid #374151", borderRadius: "12px", marginTop: "20px" },
  matrixTable: { width: "100%", borderCollapse: "collapse", minWidth: "1200px" },
  matrixHeader: { border: "1px solid #111827", padding: "10px", color: "white", textAlign: "center", fontWeight: "bold" },
  matrixIndex: { border: "1px solid #374151", padding: "10px", textAlign: "center", background: "#111827", color: "#fbbf24", fontWeight: "bold" },
  matrixCell: { border: "1px solid #111827", padding: "10px", textAlign: "center", color: "white", fontWeight: "bold" },
};
