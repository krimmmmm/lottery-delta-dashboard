
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

const APP_USERNAME = "admin";
const APP_PASSWORD = "123456789";
const matrixColors = ["#7f1d1d","#78350f","#14532d","#1e3a8a","#4c1d95","#831843","#0f766e","#374151","#365314","#92400e","#1d4ed8","#6d28d9","#be185d"];

function pad3(v){ return String(v ?? "").padStart(3,"0").slice(-3); }
function mod10(n){ return ((n % 10) + 10) % 10; }
function delta(a,b){ return mod10(Number(b)-Number(a)); }
function predictSet(fromDigit,deltas){ return deltas.map(d=>mod10(Number(fromDigit)+d)); }
function buildCombinations(h,t,u){ const r=[]; h.forEach(a=>t.forEach(b=>u.forEach(c=>r.push(`${a}${b}${c}`)))); return r.sort((x,y)=>Number(x)-Number(y)); }
function normalize(score){ return Object.entries(score).map(([delta,score])=>({delta:Number(delta),score:Number(score)})).sort((a,b)=>b.score-a.score||a.delta-b.delta); }
function confidence(scored,n=2){ const total=scored.reduce((s,x)=>s+x.score,0); const top=scored.slice(0,n).reduce((s,x)=>s+x.score,0); return total?Math.round(top/total*100):0; }

function deltaRows(rows,pos){
  const out=[];
  for(let i=1;i<rows.length;i++){
    const prev=pad3(rows[i-1].top3), curr=pad3(rows[i].top3);
    out.push({i, prev, curr, prevDigit:Number(prev[pos]), currDigit:Number(curr[pos]), delta:delta(prev[pos],curr[pos])});
  }
  return out;
}

function scoreV8(rows,pos){
  const score={}, rs=deltaRows(rows,pos), max=Math.max(rs.length,1);
  rs.forEach(r=>{ score[r.delta]=(score[r.delta]||0)+4+(r.i/max)*3+(r.delta<=3||r.delta>=7?2:0)+(r.prevDigit===r.currDigit?1:0); });
  return normalize(score);
}

function scoreV9(rows,pos){
  const score={}, rs=deltaRows(rows,pos), max=Math.max(rs.length,1), short=rs.slice(-8);
  rs.forEach(r=>{ score[r.delta]=(score[r.delta]||0)+3+(r.i/max)*2.5+(r.delta<=3||r.delta>=7?1.8:0.8); });
  short.forEach((r,idx)=>{
    score[r.delta]=(score[r.delta]||0)+5+idx*0.7;
    if(r.delta>=5||r.delta===0){ [5,6,7,8,9,0].forEach(d=>score[d]=(score[d]||0)+0.45); }
    else { [1,2,3,4].forEach(d=>score[d]=(score[d]||0)+0.35); }
  });
  return normalize(score);
}

function scoreV10(rows,pos){
  const score={};
  scoreV9(rows,pos).forEach(x=>score[x.delta]=(score[x.delta]||0)+x.score);
  for(let i=1;i<rows.length;i++){
    const p=pad3(rows[i-1].top3), c=pad3(rows[i].top3);
    const ds=[delta(p[0],c[0]),delta(p[1],c[1]),delta(p[2],c[2])];
    const target=ds[pos], others=ds.filter((_,idx)=>idx!==pos);
    score[target]=(score[target]||0);
    if((others[0]>=5||others[0]===0)&&(others[1]>=5||others[1]===0)) score[target]+=2.2;
    if(Math.abs(others[0]-others[1])>=4) [3,4,5,6,7].forEach(d=>score[d]=(score[d]||0)+0.35);
    if(p[pos]===c[pos]) score[target]+=1.2;
  }
  return normalize(score);
}

function scoreByVersion(rows,pos,version){ if(version==="v10") return scoreV10(rows,pos); if(version==="v9") return scoreV9(rows,pos); return scoreV8(rows,pos); }
function versionDescription(v){ if(v==="v10") return "V10 = V9 + Cross Position Correlation"; if(v==="v9") return "V9 = Short-Term Weight + Phase Detection"; return "V8 = Adaptive Hybrid Delta + Core Top-2"; }

export default function App(){
  const [version,setVersion]=useState("v8");
  const [isLoggedIn,setIsLoggedIn]=useState(localStorage.getItem("lottery_dashboard_login")==="yes");
  const [loginUser,setLoginUser]=useState("");
  const [loginPass,setLoginPass]=useState("");
  const [loginError,setLoginError]=useState("");
  const [draws,setDraws]=useState([]);
  const [latestInput,setLatestInput]=useState("");
  const [loading,setLoading]=useState(true);
  const [errorText,setErrorText]=useState("");

  useEffect(()=>{ if(isLoggedIn) loadData(); },[isLoggedIn]);

  function handleLogin(e){ e.preventDefault(); if(loginUser===APP_USERNAME&&loginPass===APP_PASSWORD){ localStorage.setItem("lottery_dashboard_login","yes"); setIsLoggedIn(true); setLoginError(""); } else setLoginError("Username หรือ Password ไม่ถูกต้อง"); }
  function logout(){ localStorage.removeItem("lottery_dashboard_login"); setIsLoggedIn(false); setLoginUser(""); setLoginPass(""); }

  async function loadData(){
    setLoading(true); setErrorText("");
    const {data,error}=await supabase.from("lottery_draws").select("id, draw_date, year_th, first_prize, top3").order("draw_date",{ascending:true});
    if(error){ setErrorText(error.message||"ไม่สามารถโหลดข้อมูลจาก Supabase ได้"); setDraws([]); setLoading(false); return; }
    const clean=(data||[]).filter(r=>r.draw_date&&r.top3).map(r=>({...r,top3:pad3(r.top3)}));
    setDraws(clean); if(clean.length>0) setLatestInput(clean[clean.length-1].top3); setLoading(false);
  }

  const analysis=useMemo(()=>{
    if(draws.length<2) return {nextH:[],nextT:[],nextU:[],coreH:[],coreT:[],coreU:[],core8:[],all125:[],confidence:[0,0,0],backtest:[],hitRate:0,hitCount:0,totalCount:0,coreHitRate:0,coreHitCount:0,coreTotalCount:0,fullTop5Hit:0,fullCoreHit:0,fullTotal:0,acc:[0,0,0]};
    const train=draws.slice(-48);
    const scores=[0,1,2].map(pos=>scoreByVersion(train,pos,version));
    const d5=scores.map(s=>s.slice(0,5).map(x=>x.delta));
    const d2=scores.map(s=>s.slice(0,2).map(x=>x.delta));
    const latest=pad3(latestInput||train[train.length-1].top3);
    const nextH=predictSet(latest[0],d5[0]), nextT=predictSet(latest[1],d5[1]), nextU=predictSet(latest[2],d5[2]);
    const coreH=predictSet(latest[0],d2[0]), coreT=predictSet(latest[1],d2[1]), coreU=predictSet(latest[2],d2[2]);
    const display=draws.slice(-24), backtest=[]; let hit=0,total=0,coreHit=0,coreTotal=0,fullTop5Hit=0,fullCoreHit=0,fullTotal=0; const posHit=[0,0,0], posTotal=[0,0,0];
    for(let i=1;i<display.length;i++){
      const from=pad3(display[i-1].top3), to=pad3(display[i].top3);
      const predH=predictSet(from[0],d5[0]), predT=predictSet(from[1],d5[1]), predU=predictSet(from[2],d5[2]);
      const corePredH=predictSet(from[0],d2[0]), corePredT=predictSet(from[1],d2[1]), corePredU=predictSet(from[2],d2[2]);
      const oks=[predH.includes(Number(to[0])),predT.includes(Number(to[1])),predU.includes(Number(to[2]))];
      const coks=[corePredH.includes(Number(to[0])),corePredT.includes(Number(to[1])),corePredU.includes(Number(to[2]))];
      oks.forEach((ok,idx)=>{total++; posTotal[idx]++; if(ok){hit++; posHit[idx]++;}}); coks.forEach(ok=>{coreTotal++; if(ok) coreHit++;}); fullTotal++; if(oks.every(Boolean)) fullTop5Hit++; if(coks.every(Boolean)) fullCoreHit++;
      backtest.push({date:display[i].draw_date,transition:`${from} → ${to}`,actual:to,predH,predT,predU,corePredH,corePredT,corePredU,hOk:oks[0],tOk:oks[1],uOk:oks[2],hCoreOk:coks[0],tCoreOk:coks[1],uCoreOk:coks[2],score:oks.filter(Boolean).length,coreScore:coks.filter(Boolean).length});
    }
    return {nextH,nextT,nextU,coreH,coreT,coreU,core8:buildCombinations(coreH,coreT,coreU),all125:buildCombinations(nextH,nextT,nextU),confidence:scores.map(s=>confidence(s,2)),backtest,hitRate:total?Math.round(hit/total*100):0,hitCount:hit,totalCount:total,coreHitRate:coreTotal?Math.round(coreHit/coreTotal*100):0,coreHitCount:coreHit,coreTotalCount:coreTotal,fullTop5Hit,fullCoreHit,fullTotal,acc:posTotal.map((t,i)=>t?Math.round(posHit[i]/t*100):0)};
  },[draws,latestInput,version]);

  if(!isLoggedIn) return <div style={styles.loginPage}><form onSubmit={handleLogin} style={styles.loginBox}><h1 style={styles.loginTitle}>Lottery Delta Dashboard</h1><div style={styles.loginSub}>Private Access</div><label style={styles.label}>Username</label><input value={loginUser} onChange={e=>setLoginUser(e.target.value)} style={styles.loginInput} placeholder="Username"/><label style={styles.label}>Password</label><input value={loginPass} onChange={e=>setLoginPass(e.target.value)} style={styles.loginInput} type="password" placeholder="Password"/>{loginError&&<div style={styles.loginError}>{loginError}</div>}<button type="submit" style={styles.loginButton}>Login</button><div style={styles.loginHint}>Default: admin / 123456789</div></form></div>;

  return <div style={styles.page}>
    <div style={styles.headerRow}><div><h1 style={styles.title}>Adaptive Hybrid Delta Dashboard {version.toUpperCase()}</h1><div style={styles.versionDesc}>{versionDescription(version)}</div></div><button onClick={logout} style={styles.logoutButton}>Logout</button></div>
    <div style={styles.versionBar}><button onClick={()=>setVersion("v8")} style={version==="v8"?styles.versionButtonActive:styles.versionButton}>V8 Formula</button><button onClick={()=>setVersion("v9")} style={version==="v9"?styles.versionButtonActive:styles.versionButton}>V9 Formula</button><button onClick={()=>setVersion("v10")} style={version==="v10"?styles.versionButtonActive:styles.versionButton}>V10 Formula</button></div>
    {loading&&<div style={styles.notice}>Loading data from Supabase...</div>}{errorText&&<div style={styles.errorBox}><b>Supabase Error:</b> {errorText}<br/>กรุณาตรวจสอบ Supabase Key, Table name และ RLS Policy</div>}{!loading&&!errorText&&draws.length===0&&<div style={styles.errorBox}>ไม่พบข้อมูลในตาราง <b>lottery_draws</b></div>}
    <div style={styles.grid4}><Card title="Training Window" value="24 เดือน" sub="ใช้ 48 งวดล่าสุดโดยประมาณ"/><Card title="Backtest Display" value="12 เดือน" sub="แสดง 24 งวดล่าสุดโดยประมาณ"/><Card title="Coverage" value="5 ตัว/หลัก" sub="Top-5 Dynamic"/><Card title="Total Sets" value="125" sub="5 × 5 × 5"/></div>
    <div style={styles.grid4}><div style={styles.cardBlue}><h2 style={styles.cardTitle}>กรอกเลข 3 ตัวล่าสุด</h2><input value={latestInput} maxLength={3} onChange={e=>setLatestInput(e.target.value.replace(/\D/g,"").slice(0,3))} style={styles.input} placeholder="เช่น 770"/><div style={styles.subText}>ใช้เป็นฐาน From เพื่อวิเคราะห์ช่วงถัดไป</div></div><Card title="หลักร้อย Top-5" value={analysis.nextH.join(",")||"-"}/><Card title="หลักสิบ Top-5" value={analysis.nextT.join(",")||"-"}/><Card title="หลักหน่วย Top-5" value={analysis.nextU.join(",")||"-"}/></div>
    <h2 style={styles.sectionTitle}>High Confidence Top-2 Core Signal</h2><div style={styles.grid4}><Card title="หลักร้อย เด่น 2 ตัว" value={analysis.coreH.join(",")||"-"} sub={`Confidence ${analysis.confidence[0]}%`}/><Card title="หลักสิบ เด่น 2 ตัว" value={analysis.coreT.join(",")||"-"} sub={`Confidence ${analysis.confidence[1]}%`}/><Card title="หลักหน่วย เด่น 2 ตัว" value={analysis.coreU.join(",")||"-"} sub={`Confidence ${analysis.confidence[2]}%`}/><Card title="Core 8 Sets" value="8 ชุด" sub="Top-2 × Top-2 × Top-2"/></div>
    <div style={styles.coreBox}>{analysis.core8.map(n=><span key={n} style={styles.coreChip}>{n}</span>)}</div>
    <div style={styles.grid4}><Card title="Hit Rate Top-5" value={`${analysis.hitRate}%`} sub={`${analysis.hitCount}/${analysis.totalCount} หลัก`}/><Card title="Hit Rate Core Top-2" value={`${analysis.coreHitRate}%`} sub={`${analysis.coreHitCount}/${analysis.coreTotalCount} หลัก`}/><Card title="Top-5 เข้า 3/3" value={`${analysis.fullTop5Hit}/${analysis.fullTotal}`} sub="ครบทั้ง 3 ตำแหน่ง"/><Card title="Core เข้า 3/3" value={`${analysis.fullCoreHit}/${analysis.fullTotal}`} sub="ครบทั้ง 3 ตำแหน่ง"/></div>
    <div style={styles.grid4}><Card title="หลักร้อย Accuracy" value={`${analysis.acc[0]}%`}/><Card title="หลักสิบ Accuracy" value={`${analysis.acc[1]}%`}/><Card title="หลักหน่วย Accuracy" value={`${analysis.acc[2]}%`}/><Card title="Current Version" value={version.toUpperCase()} sub={versionDescription(version)}/></div>
    <button onClick={loadData} style={styles.button}>Reload Data</button>
    <div style={styles.tableWrap}><table style={styles.table}><thead><tr><th style={styles.th}>งวดวันที่</th><th style={styles.th}>Transition</th><th style={styles.th}>เลขจริง</th><th style={styles.th}>Pred H Top-5</th><th style={styles.th}>Hit H</th><th style={styles.th}>Core H Top-2</th><th style={styles.th}>Pred T Top-5</th><th style={styles.th}>Hit T</th><th style={styles.th}>Core T Top-2</th><th style={styles.th}>Pred U Top-5</th><th style={styles.th}>Hit U</th><th style={styles.th}>Core U Top-2</th><th style={styles.th}>Top-5 Result</th><th style={styles.th}>Core Result</th></tr></thead><tbody>{analysis.backtest.map((r,idx)=><tr key={`${r.date}-${idx}`}><td style={styles.td}>{r.date}</td><td style={styles.td}>{r.transition}</td><td style={styles.td}>{r.actual}</td><td style={styles.pred}>{r.predH.join(",")}</td><td style={r.hOk?styles.hit:styles.miss}>{r.hOk?"เข้า":"ไม่เข้า"}</td><td style={r.hCoreOk?styles.coreHit:styles.coreMiss}>{r.corePredH.join(",")}</td><td style={styles.pred}>{r.predT.join(",")}</td><td style={r.tOk?styles.hit:styles.miss}>{r.tOk?"เข้า":"ไม่เข้า"}</td><td style={r.tCoreOk?styles.coreHit:styles.coreMiss}>{r.corePredT.join(",")}</td><td style={styles.pred}>{r.predU.join(",")}</td><td style={r.uOk?styles.hit:styles.miss}>{r.uOk?"เข้า":"ไม่เข้า"}</td><td style={r.uCoreOk?styles.coreHit:styles.coreMiss}>{r.corePredU.join(",")}</td><td style={styles.td}><b>{r.score}/3</b></td><td style={styles.td}><b>{r.coreScore}/3</b></td></tr>)}</tbody></table></div>
    <h2 style={styles.sectionTitle}>ข้อมูลทั้งหมดจาก Database</h2><div style={styles.tableWrap}><table style={styles.table}><thead><tr><th style={styles.th}>Date</th><th style={styles.th}>Year</th><th style={styles.th}>1st Prize</th><th style={styles.th}>Top3</th></tr></thead><tbody>{[...draws].reverse().map(item=><tr key={item.id||item.draw_date}><td style={styles.td}>{item.draw_date}</td><td style={styles.td}>{item.year_th}</td><td style={styles.td}>{item.first_prize}</td><td style={styles.td}>{item.top3}</td></tr>)}</tbody></table></div>
    <h2 style={styles.sectionTitle}>125 Combination Matrix</h2><div style={styles.matrixWrap}><table style={styles.matrixTable}><thead><tr><th style={styles.matrixHeader}>ลำดับ</th>{Array.from({length:13}).map((_,i)=><th key={i} style={{...styles.matrixHeader,background:matrixColors[i%matrixColors.length]}}>ชุดที่ {i+1}</th>)}</tr></thead><tbody>{Array.from({length:10}).map((_,row)=><tr key={row}><td style={styles.matrixIndex}>{row+1}</td>{Array.from({length:13}).map((_,col)=>{const idx=row*13+col; return <td key={col} style={{...styles.matrixCell,background:matrixColors[col%matrixColors.length]}}>{analysis.all125[idx]||"-"}</td>;})}</tr>)}</tbody></table></div>
  </div>;
}

function Card({title,value,sub}){ return <div style={styles.card}><h2 style={styles.cardTitle}>{title}</h2><div style={styles.big}>{value}</div>{sub&&<div style={styles.subText}>{sub}</div>}</div>; }

const styles={
  loginPage:{minHeight:"100vh",background:"#0f172a",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontFamily:"Arial, Tahoma, sans-serif",padding:"24px"},
  loginBox:{width:"100%",maxWidth:"420px",background:"#111827",border:"1px solid #374151",borderRadius:"18px",padding:"28px",boxShadow:"0 20px 60px rgba(0,0,0,.35)"}, loginTitle:{color:"#fbbf24",margin:"0 0 4px",fontSize:"30px"}, loginSub:{color:"#cbd5e1",marginBottom:"20px"}, label:{display:"block",color:"#fbbf24",fontWeight:"bold",margin:"12px 0 6px"}, loginInput:{width:"100%",padding:"12px",borderRadius:"10px",border:"1px solid #334155",background:"#020617",color:"white",fontSize:"16px"}, loginButton:{width:"100%",marginTop:"18px",background:"#f59e0b",color:"black",border:"none",borderRadius:"10px",padding:"12px",fontWeight:"bold",cursor:"pointer",fontSize:"16px"}, loginError:{background:"#3f1d1d",border:"1px solid #ef4444",color:"#fecaca",borderRadius:"8px",padding:"10px",marginTop:"12px"}, loginHint:{color:"#94a3b8",fontSize:"12px",marginTop:"14px",textAlign:"center"},
  page:{padding:"24px",fontFamily:"Arial, Tahoma, sans-serif",background:"#0f172a",minHeight:"100vh",color:"white"}, headerRow:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"16px",flexWrap:"wrap"}, title:{color:"#fbbf24",fontSize:"36px",margin:"0 0 8px"}, versionDesc:{color:"#cbd5e1",marginBottom:"14px"}, logoutButton:{background:"#334155",color:"white",border:"1px solid #64748b",borderRadius:"8px",padding:"9px 14px",cursor:"pointer",fontWeight:"bold"}, versionBar:{display:"flex",gap:"10px",flexWrap:"wrap",margin:"10px 0 18px"}, versionButton:{background:"#1e293b",color:"white",border:"1px solid #475569",borderRadius:"10px",padding:"10px 16px",cursor:"pointer",fontWeight:"bold"}, versionButtonActive:{background:"#f59e0b",color:"black",border:"1px solid #fbbf24",borderRadius:"10px",padding:"10px 16px",cursor:"pointer",fontWeight:"bold"}, notice:{background:"#1e293b",border:"1px solid #334155",padding:"12px",borderRadius:"10px",marginBottom:"16px"}, errorBox:{background:"#3f1d1d",color:"#fecaca",border:"1px solid #ef4444",padding:"14px",borderRadius:"10px",marginBottom:"16px"},
  grid4:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))",gap:"14px",marginBottom:"16px"}, card:{background:"#111827",border:"1px solid #374151",borderRadius:"14px",padding:"16px"}, cardBlue:{background:"#111827",border:"1px solid #38bdf8",borderRadius:"14px",padding:"16px"}, cardTitle:{color:"#fbbf24",fontSize:"16px",margin:"0 0 8px"}, big:{fontSize:"30px",color:"#fbbf24",fontWeight:"bold",wordBreak:"break-word"}, subText:{color:"#cbd5e1",fontSize:"12px",marginTop:"4px"}, input:{width:"100%",padding:"10px",borderRadius:"10px",border:"1px solid #334155",background:"#020617",color:"white",textAlign:"center",fontSize:"24px",fontWeight:"bold",letterSpacing:"3px"}, button:{background:"#f59e0b",border:"none",borderRadius:"8px",padding:"10px 16px",fontWeight:"bold",cursor:"pointer",marginBottom:"16px"}, sectionTitle:{color:"#fbbf24",marginTop:"24px"}, coreBox:{background:"#111827",border:"1px solid #374151",borderRadius:"14px",padding:"16px",marginBottom:"16px"}, coreChip:{display:"inline-block",background:"#020617",border:"1px solid #f59e0b",color:"#fde68a",borderRadius:"999px",padding:"8px 14px",margin:"5px",fontSize:"18px",fontWeight:"bold"},
  tableWrap:{overflowX:"auto",border:"1px solid #374151",borderRadius:"12px",marginTop:"12px"}, table:{width:"100%",borderCollapse:"collapse",minWidth:"1450px",background:"#111827"}, th:{border:"1px solid #374151",padding:"10px",background:"#f59e0b",color:"black",textAlign:"center"}, td:{border:"1px solid #374151",padding:"9px",textAlign:"center"}, pred:{border:"1px solid #374151",padding:"9px",textAlign:"center",color:"#fde68a"}, hit:{border:"1px solid #374151",padding:"9px",textAlign:"center",color:"#22c55e",fontWeight:"bold"}, miss:{border:"1px solid #374151",padding:"9px",textAlign:"center",color:"#ef4444",fontWeight:"bold"}, coreHit:{border:"1px solid #374151",padding:"9px",textAlign:"center",color:"#38bdf8",fontWeight:"bold"}, coreMiss:{border:"1px solid #374151",padding:"9px",textAlign:"center",color:"#94a3b8",fontWeight:"bold"},
  matrixWrap:{overflowX:"auto",border:"1px solid #374151",borderRadius:"12px",marginTop:"20px"}, matrixTable:{width:"100%",borderCollapse:"collapse",minWidth:"1200px"}, matrixHeader:{border:"1px solid #111827",padding:"10px",color:"white",textAlign:"center",fontWeight:"bold"}, matrixIndex:{border:"1px solid #374151",padding:"10px",textAlign:"center",background:"#111827",color:"#fbbf24",fontWeight:"bold"}, matrixCell:{border:"1px solid #111827",padding:"10px",textAlign:"center",color:"white",fontWeight:"bold"}
};
