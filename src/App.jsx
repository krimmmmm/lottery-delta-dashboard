วิธีเพิ่มตาราง 13 Column × 10 Row สำหรับแสดง 125 ชุด

1. นำ JSX Block ไปวางใต้ตาราง Database ด้านล่างสุด

2. นำ Style Block ไปเพิ่มใน styles object

================ JSX TABLE BLOCK ================


{/* 125 Sets Matrix Table */}
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
          <td style={styles.matrixIndex}>
            {rowIndex + 1}
          </td>

          {Array.from({ length: 13 }).map((_, colIndex) => {
            const idx = rowIndex * 13 + colIndex;

            return (
              <td
                key={colIndex}
                style={{
                  ...styles.matrixCell,
                  background:
                    matrixColors[colIndex % matrixColors.length],
                }}
              >
                {analysis.core8[idx] || "-"}
              </td>
            );
          })}
        </tr>
      ))}
    </tbody>
  </table>
</div>


================ STYLE BLOCK ================


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

matrixWrap: {
  overflowX: "auto",
  border: "1px solid #374151",
  borderRadius: "12px",
  marginTop: "20px",
},

matrixTable: {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "1200px",
},

matrixHeader: {
  border: "1px solid #111827",
  padding: "10px",
  color: "white",
  textAlign: "center",
  fontWeight: "bold",
},

matrixIndex: {
  border: "1px solid #374151",
  padding: "10px",
  textAlign: "center",
  background: "#111827",
  color: "#fbbf24",
  fontWeight: "bold",
},

matrixCell: {
  border: "1px solid #111827",
  padding: "10px",
  textAlign: "center",
  color: "white",
  fontWeight: "bold",
},
