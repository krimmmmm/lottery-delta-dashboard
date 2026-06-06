import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export default function App() {
  const [draws, setDraws] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data, error } = await supabase
      .from("lottery_draws")
      .select("*")
      .order("draw_date", { ascending: false });

    if (error) {
      console.log(error);
      return;
    }

    setDraws(data);
  }

  return (
    <div
      style={{
        padding: "20px",
        fontFamily: "Arial",
        background: "#111",
        minHeight: "100vh",
        color: "white",
      }}
    >
      <h1>Adaptive Hybrid Delta Dashboard v7</h1>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginTop: "20px",
        }}
      >
        <thead>
          <tr style={{ background: "#222" }}>
            <th style={thStyle}>Date</th>
            <th style={thStyle}>Year</th>
            <th style={thStyle}>1st Prize</th>
            <th style={thStyle}>Top3</th>
          </tr>
        </thead>

        <tbody>
          {draws.map((item) => (
            <tr key={item.id}>
              <td style={tdStyle}>{item.draw_date}</td>
              <td style={tdStyle}>{item.year_th}</td>
              <td style={tdStyle}>{item.first_prize}</td>
              <td style={tdStyle}>{item.top3}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const thStyle = {
  border: "1px solid #444",
  padding: "12px",
};

const tdStyle = {
  border: "1px solid #444",
  padding: "10px",
};
