import { useState, useEffect } from "react";

// ── ORDERS DATA ──
const statusColors = {
  pending: { bg:"#FFF3CD", text:"#856404", dot:"#FFC107" },
  confirmed: { bg:"#D1ECF1", text:"#0C5460", dot:"#17A2B8" },
  in_progress: { bg:"#CCE5FF", text:"#004085", dot:"#007BFF" },
  delivered: { bg:"#D4EDDA", text:"#155724", dot:"#28A745" },
  cancelled: { bg:"#F8D7DA", text:"#721C24", dot:"#DC3545" },
};
const statusLabels = { pending:"Pending", confirmed:"Confirmed", in_progress:"In Progress", delivered:"Delivered", cancelled:"Cancelled" };

const initialOrders = [
  { id:"#ORD-8821", customer:"María López", avatar:"ML", items:"Burger x2, Fries x1, Coke x2", total:34.50, time:"2 min ago", status:"pending", address:"Av. Insurgentes Sur 1234", phone:"+52 55 1234 5678", eta:"25 min" },
  { id:"#ORD-8820", customer:"Carlos Mendez", avatar:"CM", items:"Pizza Margherita x1, Salad x1", total:22.00, time:"8 min ago", status:"in_progress", address:"Calle Madero 456", phone:"+52 55 8765 4321", eta:"12 min" },
  { id:"#ORD-8819", customer:"Ana Rivas", avatar:"AR", items:"Tacos x3, Agua Fresca x1", total:18.75, time:"15 min ago", status:"confirmed", address:"Reforma 789, Piso 3", phone:"+52 55 2345 6789", eta:"18 min" },
  { id:"#ORD-8818", customer:"Diego Torres", avatar:"DT", items:"Sushi Roll x2, Miso Soup x1", total:45.00, time:"22 min ago", status:"delivered", address:"Polanco, CDMX", phone:"+52 55 3456 7890", eta:"Delivered" },
  { id:"#ORD-8817", customer:"Sofía Herrera", avatar:"SH", items:"Smoothie x2, Açaí Bowl x1", total:29.90, time:"30 min ago", status:"cancelled", address:"Condesa 321", phone:"+52 55 4567 8901", eta:"—" },
  { id:"#ORD-8816", customer:"Javier Mora", avatar:"JM", items:"Pasta Carbonara x2, Wine x1", total:52.00, time:"35 min ago", status:"delivered", address:"Roma Norte 654", phone:"+52 55 5678 9012", eta:"Delivered" },
];
const orderStats = [
  { label:"Orders Today", value:"148", delta:"+12%", icon:"📦" },
  { label:"Revenue", value:"$4,820", delta:"+8.3%", icon:"💰" },
  { label:"Avg. Delivery", value:"22 min", delta:"-3 min", icon:"⚡" },
  { label:"Active Riders", value:"34", delta:"+5", icon:"🛵" },
];

// ── REPORTS DATA ──
const initialReports = [
  { id:"RPT-001", type:"complaint", priority:"high", status:"open", customer:"María López", avatar:"ML", subject:"Order arrived cold", description:"Customer reports food was cold on arrival. Rider took 45 min despite 20 min ETA.", time:"10 min ago", orderId:"#ORD-8791", resolution:null },
  { id:"RPT-002", type:"suggestion", priority:"medium", status:"open", customer:"Carlos Mendez", avatar:"CM", subject:"Add scheduling feature", description:"Customer wants to schedule orders in advance for specific delivery times.", time:"1 hr ago", orderId:null, resolution:null },
  { id:"RPT-003", type:"complaint", priority:"high", status:"resolved", customer:"Ana Rivas", avatar:"AR", subject:"Wrong items delivered", description:"Customer received someone else's order. Full refund issued and correct order resent.", time:"3 hrs ago", orderId:"#ORD-8750", resolution:"Full refund issued + priority re-delivery sent within 20 min." },
  { id:"RPT-004", type:"suggestion", priority:"low", status:"open", customer:"Diego Torres", avatar:"DT", subject:"Loyalty points system", description:"Frequent customer requesting a rewards/points program for repeat orders.", time:"5 hrs ago", orderId:null, resolution:null },
  { id:"RPT-005", type:"complaint", priority:"medium", status:"in_review", customer:"Sofía Herrera", avatar:"SH", subject:"Rider was rude", description:"Customer reports rider was dismissive and did not follow delivery instructions.", time:"Yesterday", orderId:"#ORD-8734", resolution:null },
  { id:"RPT-006", type:"suggestion", priority:"medium", status:"resolved", customer:"Javier Mora", avatar:"JM", subject:"Live map tracking", description:"Customer suggested real-time GPS tracking for deliveries. Feature now in roadmap.", time:"2 days ago", orderId:null, resolution:"Added to Q2 product roadmap. Customer notified via email." },
];
const reportTypeColors = {
  complaint: { bg:"rgba(220,53,69,0.12)", text:"#FF6B6B", border:"rgba(220,53,69,0.3)" },
  suggestion: { bg:"rgba(102,126,234,0.12)", text:"#667eea", border:"rgba(102,126,234,0.3)" },
};
const priorityColors = {
  high: { bg:"rgba(255,107,53,0.15)", text:"#FF6B35" },
  medium: { bg:"rgba(255,193,7,0.15)", text:"#FFC107" },
  low: { bg:"rgba(40,167,69,0.15)", text:"#28A745" },
};
const reportStatusColors = {
  open: { bg:"rgba(255,107,53,0.12)", text:"#FF6B35", dot:"#FF6B35" },
  in_review: { bg:"rgba(0,123,255,0.12)", text:"#007BFF", dot:"#007BFF" },
  resolved: { bg:"rgba(40,167,69,0.12)", text:"#28A745", dot:"#28A745" },
};
const weeklyData = [
  { day:"Mon", orders:112 },{ day:"Tue", orders:98 },{ day:"Wed", orders:134 },
  { day:"Thu", orders:121 },{ day:"Fri", orders:167 },{ day:"Sat", orders:189 },{ day:"Sun", orders:148 },
];
const maxOrders = Math.max(...weeklyData.map(d => d.orders));

// ── RIDERS DATA ──
const initialRiders = [
  {
    id:"RDR-001", name:"Roberto Salinas", avatar:"RS", phone:"+52 55 1111 2222", email:"roberto.s@email.com",
    status:"active", joinDate:"Jan 12, 2024", zone:"Centro / Roma",
    vehicle:{ type:"Motorcycle", brand:"Honda", model:"CB125", year:2022, plate:"ABC-1234", color:"Black" },
    docs:{ id:"verified", license:"verified", insurance:"verified", vehicleReg:"verified", bgCheck:"verified" },
    stats:{ deliveries:842, rating:4.9, acceptance:94, completion:98, avgTime:"19 min", earnings:"$3,240" },
    recentTrips:[
      { id:"#ORD-8820", customer:"Carlos Mendez", amount:"$4.80", time:"8 min ago", status:"delivered" },
      { id:"#ORD-8815", customer:"Lucía Gómez", amount:"$6.20", time:"1 hr ago", status:"delivered" },
      { id:"#ORD-8809", customer:"Pedro Ruiz", amount:"$3.50", time:"3 hrs ago", status:"delivered" },
    ],
    notes:"Top-rated rider. Consistent performance. Eligible for bonus tier.",
  },
  {
    id:"RDR-002", name:"Miguel Ángel Torres", avatar:"MT", phone:"+52 55 3333 4444", email:"miguel.t@email.com",
    status:"active", joinDate:"Mar 5, 2024", zone:"Polanco / Lomas",
    vehicle:{ type:"Bicycle", brand:"Trek", model:"FX3", year:2023, plate:"N/A", color:"Blue" },
    docs:{ id:"verified", license:"verified", insurance:"pending", vehicleReg:"verified", bgCheck:"verified" },
    stats:{ deliveries:310, rating:4.7, acceptance:88, completion:95, avgTime:"24 min", earnings:"$1,180" },
    recentTrips:[
      { id:"#ORD-8818", customer:"Diego Torres", amount:"$5.10", time:"22 min ago", status:"delivered" },
      { id:"#ORD-8811", customer:"Ana Rivas", amount:"$4.40", time:"2 hrs ago", status:"delivered" },
    ],
    notes:"Insurance renewal pending. Reminder sent 3 days ago.",
  },
  {
    id:"RDR-003", name:"Fernanda Castillo", avatar:"FC", phone:"+52 55 5555 6666", email:"fernanda.c@email.com",
    status:"suspended", joinDate:"Nov 20, 2023", zone:"Condesa / Narvarte",
    vehicle:{ type:"Motorcycle", brand:"Yamaha", model:"MT-03", year:2021, plate:"XYZ-5678", color:"Red" },
    docs:{ id:"verified", license:"verified", insurance:"expired", vehicleReg:"verified", bgCheck:"verified" },
    stats:{ deliveries:654, rating:4.3, acceptance:78, completion:89, avgTime:"28 min", earnings:"$2,470" },
    recentTrips:[],
    notes:"Suspended: 3 complaints in 30 days. Insurance expired. Requires review before reinstatement.",
  },
  {
    id:"RDR-004", name:"Andrés Villanueva", avatar:"AV", phone:"+52 55 7777 8888", email:"andres.v@email.com",
    status:"pending", joinDate:"Mar 18, 2025", zone:"Tepito / Guerrero",
    vehicle:{ type:"Motorcycle", brand:"Suzuki", model:"GN125", year:2020, plate:"DEF-9012", color:"White" },
    docs:{ id:"verified", license:"pending", insurance:"pending", vehicleReg:"pending", bgCheck:"in_review" },
    stats:{ deliveries:0, rating:0, acceptance:0, completion:0, avgTime:"—", earnings:"$0" },
    recentTrips:[],
    notes:"New applicant. Background check in progress. Awaiting license and insurance upload.",
  },
  {
    id:"RDR-005", name:"Carmen Ríos", avatar:"CR", phone:"+52 55 9999 0000", email:"carmen.r@email.com",
    status:"offline", joinDate:"Aug 8, 2023", zone:"Xochimilco / Coyoacán",
    vehicle:{ type:"Car", brand:"Nissan", model:"Versa", year:2019, plate:"GHI-3456", color:"Silver" },
    docs:{ id:"verified", license:"verified", insurance:"verified", vehicleReg:"verified", bgCheck:"verified" },
    stats:{ deliveries:1204, rating:4.8, acceptance:91, completion:97, avgTime:"21 min", earnings:"$5,610" },
    recentTrips:[
      { id:"#ORD-8800", customer:"Javier Mora", amount:"$7.30", time:"Yesterday", status:"delivered" },
    ],
    notes:"Experienced rider. Currently on personal leave. Expected return Apr 1.",
  },
];

const riderStatusColors = {
  active:    { bg:"rgba(40,167,69,0.12)",  text:"#28A745", dot:"#28A745" },
  offline:   { bg:"rgba(123,128,153,0.12)", text:"#7B8099", dot:"#7B8099" },
  suspended: { bg:"rgba(220,53,69,0.12)",  text:"#FF6B6B", dot:"#DC3545" },
  pending:   { bg:"rgba(255,193,7,0.12)",  text:"#FFC107", dot:"#FFC107" },
};

const docStatusColors = {
  verified:  { color:"#28A745", icon:"✅" },
  pending:   { color:"#FFC107", icon:"⏳" },
  expired:   { color:"#DC3545", icon:"❌" },
  in_review: { color:"#007BFF", icon:"🔍" },
};

export default function App() {
  const [orders, setOrders] = useState(initialOrders);
  const [reports, setReports] = useState(initialReports);
  const [riders, setRiders] = useState(initialRiders);
  const [selected, setSelected] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedRider, setSelectedRider] = useState(null);
  const [filter, setFilter] = useState("all");
  const [reportFilter, setReportFilter] = useState("all");
  const [reportTypeFilter, setReportTypeFilter] = useState("all");
  const [riderFilter, setRiderFilter] = useState("all");
  const [riderTab, setRiderTab] = useState("overview");
  const [activeTab, setActiveTab] = useState("orders");
  const [pulse, setPulse] = useState(false);
  const [notification, setNotification] = useState(null);
  const [resolutionText, setResolutionText] = useState("");
  const [riderNote, setRiderNote] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      const newOrder = { id:"#ORD-8822", customer:"Lucía Fernández", avatar:"LF", items:"Enchiladas x2, Horchata x1", total:26.50, time:"just now", status:"pending", address:"Narvarte, CDMX", phone:"+52 55 9012 3456", eta:"28 min" };
      setOrders(prev => [newOrder, ...prev]);
      setPulse(true);
      setNotification("New order from Lucía Fernández!");
      setTimeout(() => setPulse(false), 2000);
      setTimeout(() => setNotification(null), 4000);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const handleStatusChange = (orderId, newStatus) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    setSelected(prev => prev?.id === orderId ? { ...prev, status: newStatus } : prev);
  };

  const handleReportAction = (rptId, newStatus) => {
    const res = newStatus === "resolved" ? resolutionText || "Resolved by admin." : null;
    setReports(prev => prev.map(r => r.id === rptId ? { ...r, status: newStatus, ...(res ? { resolution: res } : {}) } : r));
    setSelectedReport(prev => prev?.id === rptId ? { ...prev, status: newStatus, ...(res ? { resolution: res } : {}) } : prev);
    setResolutionText("");
  };

  const handleRiderStatusChange = (riderId, newStatus) => {
    setRiders(prev => prev.map(r => r.id === riderId ? { ...r, status: newStatus } : r));
    setSelectedRider(prev => prev?.id === riderId ? { ...prev, status: newStatus } : prev);
  };

  const handleDocVerify = (riderId, doc) => {
    setRiders(prev => prev.map(r => r.id === riderId ? { ...r, docs: { ...r.docs, [doc]: "verified" } } : r));
    setSelectedRider(prev => prev?.id === riderId ? { ...prev, docs: { ...prev.docs, [doc]: "verified" } } : prev);
  };

  const handleAddNote = (riderId) => {
    if (!riderNote.trim()) return;
    setRiders(prev => prev.map(r => r.id === riderId ? { ...r, notes: riderNote } : r));
    setSelectedRider(prev => prev?.id === riderId ? { ...prev, notes: riderNote } : prev);
    setRiderNote("");
  };

  const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter);
  const filteredReports = reports.filter(r => {
    const s = reportFilter === "all" || r.status === reportFilter;
    const t = reportTypeFilter === "all" || r.type === reportTypeFilter;
    return s && t;
  });
  const filteredRiders = riderFilter === "all" ? riders : riders.filter(r => r.status === riderFilter);
  const openCount = reports.filter(r => r.status === "open").length;
  const pendingRiders = riders.filter(r => r.status === "pending").length;

  const navItems = [
    ["🗂️","Orders","orders"],
    ["📊","Reports","reports"],
    ["🛵","Riders","riders"],
    ["🍽️","Menu","menu"],
    ["👤","Customers","customers"],
    ["⚙️","Settings","settings"],
  ];

  const StarRating = ({ rating }) => {
    if (!rating) return <span style={{ color:"#555B75", fontSize:12 }}>No ratings yet</span>;
    return (
      <div style={{ display:"flex", alignItems:"center", gap:4 }}>
        {[1,2,3,4,5].map(i => (
          <span key={i} style={{ color: i <= Math.round(rating) ? "#FFC107" : "#252836", fontSize:14 }}>★</span>
        ))}
        <span style={{ fontSize:12, fontWeight:700, color:"#E8EAF0", marginLeft:4 }}>{rating.toFixed(1)}</span>
      </div>
    );
  };

  return (
    <div style={{ fontFamily:"'DM Sans','Segoe UI',sans-serif", background:"#0F1117", minHeight:"100vh", color:"#E8EAF0", display:"flex", flexDirection:"column" }}>
      <style>{`
        @keyframes slideIn { from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)} }
        @keyframes fadeIn  { from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)} }
        .rh:hover { background:rgba(255,255,255,0.03) !important; }
        button:hover { opacity:0.85; }
        ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-track{background:#13151E} ::-webkit-scrollbar-thumb{background:#2a2d3e;border-radius:3px}
      `}</style>

      {/* Header */}
      <header style={{ background:"#181B25", borderBottom:"1px solid #252836", padding:"0 24px", display:"flex", alignItems:"center", justifyContent:"space-between", height:56, position:"sticky", top:0, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:8, background:"linear-gradient(135deg,#FF6B35,#FF3D00)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🚀</div>
          <span style={{ fontWeight:700, fontSize:16 }}>OrderPanel</span>
          <span style={{ background:"#252836", color:"#7B8099", fontSize:11, padding:"2px 8px", borderRadius:20 }}>Admin</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ background:pulse?"rgba(255,107,53,0.15)":"#252836", border:pulse?"1px solid #FF6B35":"1px solid #252836", borderRadius:8, padding:"5px 12px", fontSize:12, display:"flex", alignItems:"center", gap:6, transition:"all 0.3s" }}>
            <span style={{ width:7, height:7, borderRadius:"50%", background:"#28A745", boxShadow:"0 0 6px #28A745", display:"inline-block" }} /> Live
          </div>
          <div style={{ width:32, height:32, borderRadius:"50%", background:"linear-gradient(135deg,#667eea,#764ba2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700 }}>AD</div>
        </div>
      </header>

      {notification && (
        <div style={{ position:"fixed", top:68, right:20, zIndex:999, background:"#FF6B35", color:"#fff", padding:"11px 18px", borderRadius:10, fontSize:13, fontWeight:600, boxShadow:"0 8px 30px rgba(255,107,53,0.4)", animation:"slideIn 0.3s ease", display:"flex", alignItems:"center", gap:8 }}>
          🔔 {notification}
        </div>
      )}

      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>
        {/* Sidebar */}
        <aside style={{ width:180, background:"#181B25", borderRight:"1px solid #252836", padding:"16px 10px", display:"flex", flexDirection:"column", gap:3 }}>
          {navItems.map(([icon,label,key]) => (
            <div key={key} onClick={() => { setActiveTab(key); setSelected(null); setSelectedReport(null); setSelectedRider(null); }} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 10px", borderRadius:8, cursor:"pointer", background:activeTab===key?"rgba(255,107,53,0.12)":"transparent", color:activeTab===key?"#FF6B35":"#7B8099", fontSize:13, fontWeight:activeTab===key?600:400, transition:"all 0.2s" }}>
              <span style={{ display:"flex", alignItems:"center", gap:9 }}>{icon} {label}</span>
              {key==="reports" && openCount>0 && <span style={{ background:"#FF6B35", color:"#fff", fontSize:10, fontWeight:700, padding:"1px 6px", borderRadius:20 }}>{openCount}</span>}
              {key==="riders" && pendingRiders>0 && <span style={{ background:"#FFC107", color:"#000", fontSize:10, fontWeight:700, padding:"1px 6px", borderRadius:20 }}>{pendingRiders}</span>}
            </div>
          ))}
        </aside>

        {/* ── ORDERS TAB ── */}
        {activeTab==="orders" && (
          <main style={{ flex:1, padding:20, overflowY:"auto", animation:"fadeIn 0.3s ease" }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
              {orderStats.map(s => (
                <div key={s.label} style={{ background:"#181B25", border:"1px solid #252836", borderRadius:12, padding:"14px 18px" }}>
                  <div style={{ fontSize:20, marginBottom:4 }}>{s.icon}</div>
                  <div style={{ fontSize:22, fontWeight:700 }}>{s.value}</div>
                  <div style={{ fontSize:11, color:"#7B8099", marginTop:2 }}>{s.label}</div>
                  <div style={{ fontSize:11, color:"#28A745", marginTop:4 }}>↑ {s.delta}</div>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:7, marginBottom:14, flexWrap:"wrap" }}>
              {["all","pending","confirmed","in_progress","delivered","cancelled"].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{ padding:"5px 13px", borderRadius:20, border:"1px solid", fontSize:11, fontWeight:600, cursor:"pointer", background:filter===f?"#FF6B35":"transparent", borderColor:filter===f?"#FF6B35":"#252836", color:filter===f?"#fff":"#7B8099", transition:"all 0.2s" }}>
                  {f==="all"?"All Orders":statusLabels[f]}
                </button>
              ))}
            </div>
            <div style={{ background:"#181B25", border:"1px solid #252836", borderRadius:12, overflow:"hidden" }}>
              <div style={{ display:"grid", gridTemplateColumns:"100px 1fr 1.4fr 80px 95px 120px 85px", padding:"9px 18px", background:"#13151E", fontSize:10, fontWeight:700, color:"#555B75", textTransform:"uppercase", letterSpacing:"0.06em", borderBottom:"1px solid #252836" }}>
                <span>Order</span><span>Customer</span><span>Items</span><span>Total</span><span>Time</span><span>Status</span><span>Action</span>
              </div>
              {filtered.map((order,i) => (
                <div key={order.id} className="rh" onClick={() => setSelected(order)} style={{ display:"grid", gridTemplateColumns:"100px 1fr 1.4fr 80px 95px 120px 85px", padding:"13px 18px", borderBottom:i<filtered.length-1?"1px solid #1C1F2E":"none", cursor:"pointer", background:selected?.id===order.id?"rgba(255,107,53,0.06)":"transparent", transition:"background 0.15s", alignItems:"center" }}>
                  <span style={{ fontSize:12, fontWeight:700, color:"#A0A8C0" }}>{order.id}</span>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:28, height:28, borderRadius:"50%", background:"linear-gradient(135deg,#667eea,#764ba2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, flexShrink:0 }}>{order.avatar}</div>
                    <span style={{ fontSize:13, fontWeight:600 }}>{order.customer}</span>
                  </div>
                  <span style={{ fontSize:12, color:"#7B8099", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{order.items}</span>
                  <span style={{ fontSize:13, fontWeight:700 }}>${order.total.toFixed(2)}</span>
                  <span style={{ fontSize:12, color:"#7B8099" }}>{order.time}</span>
                  <span style={{ background:statusColors[order.status].bg, color:statusColors[order.status].text, padding:"3px 9px", borderRadius:20, fontSize:11, fontWeight:600, display:"inline-flex", alignItems:"center", gap:5, width:"fit-content" }}>
                    <span style={{ width:6, height:6, borderRadius:"50%", background:statusColors[order.status].dot, display:"inline-block" }} />
                    {statusLabels[order.status]}
                  </span>
                  <button onClick={e => { e.stopPropagation(); setSelected(order); }} style={{ background:"transparent", border:"1px solid #252836", color:"#A0A8C0", padding:"4px 10px", borderRadius:6, fontSize:12, cursor:"pointer" }}>View →</button>
                </div>
              ))}
            </div>
          </main>
        )}
        {activeTab==="orders" && selected && (
          <aside style={{ width:280, background:"#181B25", borderLeft:"1px solid #252836", padding:18, display:"flex", flexDirection:"column", gap:14, overflowY:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontWeight:700, fontSize:15 }}>{selected.id}</span>
              <button onClick={() => setSelected(null)} style={{ background:"#252836", border:"none", color:"#7B8099", width:26, height:26, borderRadius:6, cursor:"pointer", fontSize:13 }}>✕</button>
            </div>
            {[
              { title:"Customer", content:<div style={{ display:"flex", alignItems:"center", gap:10 }}><div style={{ width:34, height:34, borderRadius:"50%", background:"linear-gradient(135deg,#667eea,#764ba2)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700 }}>{selected.avatar}</div><div><div style={{ fontWeight:600, fontSize:13 }}>{selected.customer}</div><div style={{ fontSize:12, color:"#7B8099" }}>{selected.phone}</div></div></div> },
              { title:"Address", content:<div style={{ fontSize:13, color:"#A0A8C0" }}>📍 {selected.address}</div> },
              { title:"ETA", content:<div style={{ fontSize:19, fontWeight:700 }}>⏱ {selected.eta}</div> },
            ].map(({ title, content }) => (
              <div key={title} style={{ background:"#13151E", borderRadius:10, padding:13 }}>
                <div style={{ fontSize:10, color:"#555B75", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.06em" }}>{title}</div>
                {content}
              </div>
            ))}
            <div style={{ background:"#13151E", borderRadius:10, padding:13 }}>
              <div style={{ fontSize:10, color:"#555B75", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.06em" }}>Items</div>
              {selected.items.split(", ").map(item => <div key={item} style={{ fontSize:13, padding:"4px 0", borderBottom:"1px solid #1C1F2E" }}>{item}</div>)}
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:10, fontWeight:700, fontSize:14 }}>
                <span>Total</span><span style={{ color:"#FF6B35" }}>${selected.total.toFixed(2)}</span>
              </div>
            </div>
            {selected.status !== "delivered" && selected.status !== "cancelled" && (
              <div style={{ background:"#13151E", borderRadius:10, padding:13 }}>
                <div style={{ fontSize:10, color:"#555B75", marginBottom:10, textTransform:"uppercase", letterSpacing:"0.06em" }}>Update Status</div>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {selected.status==="pending" && <button onClick={() => handleStatusChange(selected.id,"confirmed")} style={{ background:"#17A2B8", border:"none", color:"#fff", padding:9, borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:13 }}>✓ Confirm Order</button>}
                  {selected.status==="confirmed" && <button onClick={() => handleStatusChange(selected.id,"in_progress")} style={{ background:"#007BFF", border:"none", color:"#fff", padding:9, borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:13 }}>🛵 Start Delivery</button>}
                  {selected.status==="in_progress" && <button onClick={() => handleStatusChange(selected.id,"delivered")} style={{ background:"#28A745", border:"none", color:"#fff", padding:9, borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:13 }}>✅ Mark Delivered</button>}
                  <button onClick={() => handleStatusChange(selected.id,"cancelled")} style={{ background:"transparent", border:"1px solid #DC3545", color:"#DC3545", padding:9, borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:13 }}>✕ Cancel Order</button>
                </div>
              </div>
            )}
          </aside>
        )}

        {/* ── REPORTS TAB ── */}
        {activeTab==="reports" && (
          <>
            <main style={{ flex:1, padding:20, overflowY:"auto", animation:"fadeIn 0.3s ease" }}>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
                {[
                  { icon:"🚨", label:"Open Issues", value:openCount, color:"#FF6B35" },
                  { icon:"🔍", label:"In Review", value:reports.filter(r=>r.status==="in_review").length, color:"#007BFF" },
                  { icon:"✅", label:"Resolved", value:reports.filter(r=>r.status==="resolved").length, color:"#28A745" },
                  { icon:"💡", label:"Suggestions", value:reports.filter(r=>r.type==="suggestion").length, color:"#667eea" },
                ].map(s => (
                  <div key={s.label} style={{ background:"#181B25", border:"1px solid #252836", borderRadius:12, padding:"14px 18px" }}>
                    <div style={{ fontSize:20, marginBottom:4 }}>{s.icon}</div>
                    <div style={{ fontSize:22, fontWeight:700, color:s.color }}>{s.value}</div>
                    <div style={{ fontSize:11, color:"#7B8099", marginTop:2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ background:"#181B25", border:"1px solid #252836", borderRadius:12, padding:"16px 20px", marginBottom:20 }}>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:14, color:"#A0A8C0" }}>📈 Weekly Orders</div>
                <div style={{ display:"flex", alignItems:"flex-end", gap:8, height:72 }}>
                  {weeklyData.map(d => (
                    <div key={d.day} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                      <div style={{ fontSize:10, color:"#7B8099" }}>{d.orders}</div>
                      <div style={{ width:"100%", background:"linear-gradient(180deg,#FF6B35,#FF3D00)", borderRadius:"3px 3px 0 0", height:`${(d.orders/maxOrders)*52}px`, opacity:d.day==="Sun"?1:0.55 }} />
                      <div style={{ fontSize:10, color:"#555B75" }}>{d.day}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
                <span style={{ fontSize:11, color:"#555B75" }}>Status:</span>
                {["all","open","in_review","resolved"].map(f => (
                  <button key={f} onClick={() => setReportFilter(f)} style={{ padding:"4px 12px", borderRadius:20, border:"1px solid", fontSize:11, fontWeight:600, cursor:"pointer", background:reportFilter===f?"#FF6B35":"transparent", borderColor:reportFilter===f?"#FF6B35":"#252836", color:reportFilter===f?"#fff":"#7B8099", transition:"all 0.2s" }}>
                    {f==="all"?"All":f==="in_review"?"In Review":f[0].toUpperCase()+f.slice(1)}
                  </button>
                ))}
                <span style={{ fontSize:11, color:"#555B75", marginLeft:8 }}>Type:</span>
                {["all","complaint","suggestion"].map(f => (
                  <button key={f} onClick={() => setReportTypeFilter(f)} style={{ padding:"4px 12px", borderRadius:20, border:"1px solid", fontSize:11, fontWeight:600, cursor:"pointer", background:reportTypeFilter===f?"#667eea":"transparent", borderColor:reportTypeFilter===f?"#667eea":"#252836", color:reportTypeFilter===f?"#fff":"#7B8099", transition:"all 0.2s" }}>
                    {f==="all"?"All Types":f[0].toUpperCase()+f.slice(1)}
                  </button>
                ))}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {filteredReports.map(r => (
                  <div key={r.id} className="rh" onClick={() => { setSelectedReport(r); setResolutionText(""); }} style={{ background:"#181B25", border:selectedReport?.id===r.id?"1px solid rgba(255,107,53,0.5)":"1px solid #252836", borderRadius:12, padding:"14px 18px", cursor:"pointer", transition:"all 0.2s" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                        <div style={{ width:30, height:30, borderRadius:"50%", background:"linear-gradient(135deg,#667eea,#764ba2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, flexShrink:0 }}>{r.avatar}</div>
                        <div>
                          <div style={{ fontWeight:600, fontSize:13 }}>{r.subject}</div>
                          <div style={{ fontSize:11, color:"#7B8099" }}>{r.customer} · {r.time}</div>
                        </div>
                      </div>
                      <div style={{ display:"flex", gap:5, flexWrap:"wrap", justifyContent:"flex-end" }}>
                        <span style={{ background:reportTypeColors[r.type].bg, color:reportTypeColors[r.type].text, border:`1px solid ${reportTypeColors[r.type].border}`, padding:"2px 8px", borderRadius:20, fontSize:10, fontWeight:700 }}>{r.type==="complaint"?"🚨 Complaint":"💡 Suggestion"}</span>
                        <span style={{ background:priorityColors[r.priority].bg, color:priorityColors[r.priority].text, padding:"2px 8px", borderRadius:20, fontSize:10, fontWeight:700 }}>{r.priority.toUpperCase()}</span>
                        <span style={{ background:reportStatusColors[r.status].bg, color:reportStatusColors[r.status].text, padding:"2px 8px", borderRadius:20, fontSize:10, fontWeight:700, display:"inline-flex", alignItems:"center", gap:4 }}>
                          <span style={{ width:5, height:5, borderRadius:"50%", background:reportStatusColors[r.status].dot, display:"inline-block" }} />
                          {r.status==="in_review"?"In Review":r.status[0].toUpperCase()+r.status.slice(1)}
                        </span>
                      </div>
                    </div>
                    <p style={{ fontSize:12, color:"#7B8099", margin:0, paddingLeft:39, lineHeight:1.55 }}>{r.description}</p>
                    {r.resolution && (
                      <div style={{ marginTop:10, marginLeft:39, background:"rgba(40,167,69,0.08)", border:"1px solid rgba(40,167,69,0.2)", borderRadius:8, padding:"8px 12px", fontSize:12, color:"#28A745" }}>
                        ✅ <strong>Resolution:</strong> {r.resolution}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </main>
            {selectedReport && (
              <aside style={{ width:290, background:"#181B25", borderLeft:"1px solid #252836", padding:18, display:"flex", flexDirection:"column", gap:13, overflowY:"auto", animation:"fadeIn 0.2s ease" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontWeight:700, fontSize:14, color:"#A0A8C0" }}>{selectedReport.id}</span>
                  <button onClick={() => setSelectedReport(null)} style={{ background:"#252836", border:"none", color:"#7B8099", width:26, height:26, borderRadius:6, cursor:"pointer", fontSize:13 }}>✕</button>
                </div>
                <div style={{ background:"#13151E", borderRadius:10, padding:13 }}>
                  <div style={{ fontSize:10, color:"#555B75", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.06em" }}>From</div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:32, height:32, borderRadius:"50%", background:"linear-gradient(135deg,#667eea,#764ba2)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:12 }}>{selectedReport.avatar}</div>
                    <span style={{ fontWeight:600, fontSize:13 }}>{selectedReport.customer}</span>
                  </div>
                </div>
                <div style={{ background:"#13151E", borderRadius:10, padding:13 }}>
                  <div style={{ fontSize:10, color:"#555B75", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.06em" }}>Subject</div>
                  <div style={{ fontSize:13, fontWeight:600 }}>{selectedReport.subject}</div>
                </div>
                <div style={{ background:"#13151E", borderRadius:10, padding:13 }}>
                  <div style={{ fontSize:10, color:"#555B75", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.06em" }}>Details</div>
                  <div style={{ fontSize:12, color:"#A0A8C0", lineHeight:1.6 }}>{selectedReport.description}</div>
                </div>
                {selectedReport.orderId && (
                  <div style={{ background:"#13151E", borderRadius:10, padding:13 }}>
                    <div style={{ fontSize:10, color:"#555B75", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.06em" }}>Linked Order</div>
                    <div style={{ fontSize:13, color:"#667eea", fontWeight:600 }}>{selectedReport.orderId}</div>
                  </div>
                )}
                {selectedReport.resolution && (
                  <div style={{ background:"rgba(40,167,69,0.08)", border:"1px solid rgba(40,167,69,0.2)", borderRadius:10, padding:13 }}>
                    <div style={{ fontSize:10, color:"#28A745", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.06em" }}>✅ Resolution</div>
                    <div style={{ fontSize:12, color:"#A0A8C0", lineHeight:1.6 }}>{selectedReport.resolution}</div>
                  </div>
                )}
                {selectedReport.status !== "resolved" && (
                  <div style={{ background:"#13151E", borderRadius:10, padding:13 }}>
                    <div style={{ fontSize:10, color:"#555B75", marginBottom:10, textTransform:"uppercase", letterSpacing:"0.06em" }}>Take Action</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                      {selectedReport.status==="open" && (
                        <button onClick={() => handleReportAction(selectedReport.id,"in_review")} style={{ background:"#007BFF", border:"none", color:"#fff", padding:9, borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:13 }}>🔍 Mark In Review</button>
                      )}
                      <textarea value={resolutionText} onChange={e => setResolutionText(e.target.value)} placeholder="Write resolution notes..." style={{ background:"#0F1117", border:"1px solid #252836", color:"#E8EAF0", borderRadius:8, padding:"9px 12px", fontSize:12, fontFamily:"inherit", minHeight:68, outline:"none", width:"100%", boxSizing:"border-box", resize:"vertical" }} />
                      <button onClick={() => handleReportAction(selectedReport.id,"resolved")} style={{ background:"#28A745", border:"none", color:"#fff", padding:9, borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:13 }}>✅ Mark as Resolved</button>
                    </div>
                  </div>
                )}
                <div style={{ background:"rgba(102,126,234,0.08)", border:"1px solid rgba(102,126,234,0.2)", borderRadius:10, padding:13 }}>
                  <div style={{ fontSize:10, color:"#667eea", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.06em" }}>💡 How Big Platforms Handle This</div>
                  {selectedReport.type==="complaint" ? (
                    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                      {[["Uber Eats","Auto-refund triggered if delivery is 15+ min late"],["Rappi","Live chat escalation assigned within 2 min"],["Airbnb","24hr resolution SLA; host penalized for repeat issues"],["DoorDash","Instant credit issued; case reviewed async by team"]].map(([p,d]) => (
                        <div key={p} style={{ fontSize:11, color:"#A0A8C0", lineHeight:1.5 }}><span style={{ fontWeight:700, color:"#E8EAF0" }}>{p}:</span> {d}</div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                      {[["Uber","Public idea board — customers upvote features"],["Airbnb","Suggestions reviewed quarterly by product team"],["Rappi","AI auto-clusters similar suggestions for review"],["DoorDash","Accepted ideas get a public ETA communicated back"]].map(([p,d]) => (
                        <div key={p} style={{ fontSize:11, color:"#A0A8C0", lineHeight:1.5 }}><span style={{ fontWeight:700, color:"#E8EAF0" }}>{p}:</span> {d}</div>
                      ))}
                    </div>
                  )}
                </div>
              </aside>
            )}
          </>
        )}

        {/* ── RIDERS TAB ── */}
        {activeTab==="riders" && (
          <>
            <main style={{ flex:1, padding:20, overflowY:"auto", animation:"fadeIn 0.3s ease" }}>
              {/* Rider Stats */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
                {[
                  { icon:"🟢", label:"Active Now", value:riders.filter(r=>r.status==="active").length, color:"#28A745" },
                  { icon:"⏳", label:"Pending Review", value:pendingRiders, color:"#FFC107" },
                  { icon:"🚫", label:"Suspended", value:riders.filter(r=>r.status==="suspended").length, color:"#DC3545" },
                  { icon:"🛵", label:"Total Riders", value:riders.length, color:"#667eea" },
                ].map(s => (
                  <div key={s.label} style={{ background:"#181B25", border:"1px solid #252836", borderRadius:12, padding:"14px 18px" }}>
                    <div style={{ fontSize:20, marginBottom:4 }}>{s.icon}</div>
                    <div style={{ fontSize:22, fontWeight:700, color:s.color }}>{s.value}</div>
                    <div style={{ fontSize:11, color:"#7B8099", marginTop:2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Filter */}
              <div style={{ display:"flex", gap:7, marginBottom:14 }}>
                {["all","active","pending","suspended","offline"].map(f => (
                  <button key={f} onClick={() => setRiderFilter(f)} style={{ padding:"5px 13px", borderRadius:20, border:"1px solid", fontSize:11, fontWeight:600, cursor:"pointer", background:riderFilter===f?"#FF6B35":"transparent", borderColor:riderFilter===f?"#FF6B35":"#252836", color:riderFilter===f?"#fff":"#7B8099", transition:"all 0.2s" }}>
                    {f==="all"?"All Riders":f.charAt(0).toUpperCase()+f.slice(1)}
                  </button>
                ))}
              </div>

              {/* Rider table */}
              <div style={{ background:"#181B25", border:"1px solid #252836", borderRadius:12, overflow:"hidden" }}>
                <div style={{ display:"grid", gridTemplateColumns:"44px 1fr 110px 130px 80px 80px 100px 90px", padding:"9px 18px", background:"#13151E", fontSize:10, fontWeight:700, color:"#555B75", textTransform:"uppercase", letterSpacing:"0.06em", borderBottom:"1px solid #252836" }}>
                  <span></span><span>Rider</span><span>Status</span><span>Zone</span><span>Deliveries</span><span>Rating</span><span>Docs</span><span>Action</span>
                </div>
                {filteredRiders.map((rider, i) => {
                  const docIssues = Object.values(rider.docs).filter(v => v !== "verified").length;
                  return (
                    <div key={rider.id} className="rh" onClick={() => { setSelectedRider(rider); setRiderTab("overview"); setRiderNote(rider.notes||""); }} style={{ display:"grid", gridTemplateColumns:"44px 1fr 110px 130px 80px 80px 100px 90px", padding:"13px 18px", borderBottom:i<filteredRiders.length-1?"1px solid #1C1F2E":"none", cursor:"pointer", background:selectedRider?.id===rider.id?"rgba(255,107,53,0.06)":"transparent", transition:"background 0.15s", alignItems:"center" }}>
                      <div style={{ width:32, height:32, borderRadius:"50%", background:"linear-gradient(135deg,#667eea,#764ba2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700 }}>{rider.avatar}</div>
                      <div>
                        <div style={{ fontSize:13, fontWeight:600 }}>{rider.name}</div>
                        <div style={{ fontSize:11, color:"#7B8099" }}>{rider.vehicle.type} · {rider.vehicle.brand} {rider.vehicle.model}</div>
                      </div>
                      <span style={{ background:riderStatusColors[rider.status].bg, color:riderStatusColors[rider.status].text, padding:"3px 9px", borderRadius:20, fontSize:11, fontWeight:600, display:"inline-flex", alignItems:"center", gap:5, width:"fit-content" }}>
                        <span style={{ width:6, height:6, borderRadius:"50%", background:riderStatusColors[rider.status].dot, display:"inline-block" }} />
                        {rider.status.charAt(0).toUpperCase()+rider.status.slice(1)}
                      </span>
                      <span style={{ fontSize:12, color:"#7B8099" }}>{rider.zone}</span>
                      <span style={{ fontSize:13, fontWeight:700 }}>{rider.stats.deliveries}</span>
                      <span style={{ fontSize:13, fontWeight:700, color: rider.stats.rating >= 4.7 ? "#28A745" : rider.stats.rating >= 4.0 ? "#FFC107" : rider.stats.rating === 0 ? "#555B75" : "#DC3545" }}>
                        {rider.stats.rating ? `★ ${rider.stats.rating}` : "—"}
                      </span>
                      <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                        {docIssues > 0
                          ? <span style={{ background:"rgba(220,53,69,0.12)", color:"#FF6B6B", padding:"2px 8px", borderRadius:20, fontSize:10, fontWeight:700 }}>⚠ {docIssues} issue{docIssues>1?"s":""}</span>
                          : <span style={{ background:"rgba(40,167,69,0.12)", color:"#28A745", padding:"2px 8px", borderRadius:20, fontSize:10, fontWeight:700 }}>✅ Clear</span>
                        }
                      </div>
                      <button onClick={e => { e.stopPropagation(); setSelectedRider(rider); setRiderTab("overview"); setRiderNote(rider.notes||""); }} style={{ background:"transparent", border:"1px solid #252836", color:"#A0A8C0", padding:"4px 10px", borderRadius:6, fontSize:12, cursor:"pointer" }}>View →</button>
                    </div>
                  );
                })}
              </div>
            </main>

            {/* Rider Detail Panel */}
            {selectedRider && (
              <aside style={{ width:320, background:"#181B25", borderLeft:"1px solid #252836", padding:18, display:"flex", flexDirection:"column", gap:13, overflowY:"auto", animation:"fadeIn 0.2s ease" }}>
                {/* Header */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontWeight:700, fontSize:13, color:"#A0A8C0" }}>{selectedRider.id}</span>
                  <button onClick={() => setSelectedRider(null)} style={{ background:"#252836", border:"none", color:"#7B8099", width:26, height:26, borderRadius:6, cursor:"pointer", fontSize:13 }}>✕</button>
                </div>

                {/* Rider identity */}
                <div style={{ display:"flex", alignItems:"center", gap:12, background:"#13151E", borderRadius:10, padding:13 }}>
                  <div style={{ width:46, height:46, borderRadius:"50%", background:"linear-gradient(135deg,#667eea,#764ba2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:700, flexShrink:0 }}>{selectedRider.avatar}</div>
                  <div>
                    <div style={{ fontWeight:700, fontSize:14 }}>{selectedRider.name}</div>
                    <div style={{ fontSize:11, color:"#7B8099" }}>{selectedRider.phone}</div>
                    <div style={{ fontSize:11, color:"#7B8099" }}>{selectedRider.email}</div>
                    <div style={{ marginTop:5 }}>
                      <span style={{ background:riderStatusColors[selectedRider.status].bg, color:riderStatusColors[selectedRider.status].text, padding:"2px 8px", borderRadius:20, fontSize:10, fontWeight:700, display:"inline-flex", alignItems:"center", gap:4 }}>
                        <span style={{ width:5, height:5, borderRadius:"50%", background:riderStatusColors[selectedRider.status].dot, display:"inline-block" }} />
                        {selectedRider.status.charAt(0).toUpperCase()+selectedRider.status.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sub-tabs */}
                <div style={{ display:"flex", gap:4, background:"#13151E", borderRadius:8, padding:4 }}>
                  {["overview","documents","trips","notes"].map(t => (
                    <button key={t} onClick={() => setRiderTab(t)} style={{ flex:1, padding:"5px 4px", borderRadius:6, border:"none", fontSize:11, fontWeight:600, cursor:"pointer", background:riderTab===t?"#252836":"transparent", color:riderTab===t?"#E8EAF0":"#555B75", transition:"all 0.2s" }}>
                      {t.charAt(0).toUpperCase()+t.slice(1)}
                    </button>
                  ))}
                </div>

                {/* OVERVIEW */}
                {riderTab==="overview" && (
                  <>
                    <div style={{ background:"#13151E", borderRadius:10, padding:13 }}>
                      <div style={{ fontSize:10, color:"#555B75", marginBottom:10, textTransform:"uppercase", letterSpacing:"0.06em" }}>Performance</div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                        {[
                          { label:"Deliveries", value:selectedRider.stats.deliveries },
                          { label:"Avg. Time", value:selectedRider.stats.avgTime },
                          { label:"Acceptance", value:selectedRider.stats.acceptance ? `${selectedRider.stats.acceptance}%`:"—" },
                          { label:"Completion", value:selectedRider.stats.completion ? `${selectedRider.stats.completion}%`:"—" },
                          { label:"Earnings", value:selectedRider.stats.earnings },
                          { label:"Joined", value:selectedRider.joinDate },
                        ].map(({ label, value }) => (
                          <div key={label} style={{ background:"#0F1117", borderRadius:8, padding:"9px 11px" }}>
                            <div style={{ fontSize:10, color:"#555B75", marginBottom:3 }}>{label}</div>
                            <div style={{ fontSize:14, fontWeight:700 }}>{value}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop:10 }}>
                        <div style={{ fontSize:10, color:"#555B75", marginBottom:5 }}>Rating</div>
                        <StarRating rating={selectedRider.stats.rating} />
                      </div>
                    </div>

                    <div style={{ background:"#13151E", borderRadius:10, padding:13 }}>
                      <div style={{ fontSize:10, color:"#555B75", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.06em" }}>Vehicle</div>
                      {[
                        ["Type", selectedRider.vehicle.type],
                        ["Brand / Model", `${selectedRider.vehicle.brand} ${selectedRider.vehicle.model}`],
                        ["Year", selectedRider.vehicle.year],
                        ["Plate", selectedRider.vehicle.plate],
                        ["Color", selectedRider.vehicle.color],
                        ["Zone", selectedRider.zone],
                      ].map(([k,v]) => (
                        <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"4px 0", borderBottom:"1px solid #1C1F2E" }}>
                          <span style={{ color:"#555B75" }}>{k}</span>
                          <span style={{ fontWeight:600 }}>{v}</span>
                        </div>
                      ))}
                    </div>

                    {/* Admin actions */}
                    <div style={{ background:"#13151E", borderRadius:10, padding:13 }}>
                      <div style={{ fontSize:10, color:"#555B75", marginBottom:10, textTransform:"uppercase", letterSpacing:"0.06em" }}>Admin Actions</div>
                      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                        {selectedRider.status==="pending" && <>
                          <button onClick={() => handleRiderStatusChange(selectedRider.id,"active")} style={{ background:"#28A745", border:"none", color:"#fff", padding:9, borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:13 }}>✅ Approve Rider</button>
                          <button onClick={() => handleRiderStatusChange(selectedRider.id,"suspended")} style={{ background:"transparent", border:"1px solid #DC3545", color:"#DC3545", padding:9, borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:13 }}>✕ Reject Application</button>
                        </>}
                        {selectedRider.status==="active" && <>
                          <button onClick={() => handleRiderStatusChange(selectedRider.id,"suspended")} style={{ background:"transparent", border:"1px solid #DC3545", color:"#DC3545", padding:9, borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:13 }}>🚫 Suspend Rider</button>
                        </>}
                        {selectedRider.status==="suspended" && <>
                          <button onClick={() => handleRiderStatusChange(selectedRider.id,"active")} style={{ background:"#28A745", border:"none", color:"#fff", padding:9, borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:13 }}>✅ Reinstate Rider</button>
                        </>}
                        {selectedRider.status==="offline" && <>
                          <button onClick={() => handleRiderStatusChange(selectedRider.id,"active")} style={{ background:"#007BFF", border:"none", color:"#fff", padding:9, borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:13 }}>🔄 Set Active</button>
                        </>}
                      </div>
                    </div>
                  </>
                )}

                {/* DOCUMENTS */}
                {riderTab==="documents" && (
                  <div style={{ background:"#13151E", borderRadius:10, padding:13 }}>
                    <div style={{ fontSize:10, color:"#555B75", marginBottom:12, textTransform:"uppercase", letterSpacing:"0.06em" }}>Document Verification</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                      {[
                        ["id", "Government ID"],
                        ["license", "Driver's License"],
                        ["insurance", "Insurance Policy"],
                        ["vehicleReg", "Vehicle Registration"],
                        ["bgCheck", "Background Check"],
                      ].map(([key, label]) => {
                        const docStatus = selectedRider.docs[key];
                        const dc = docStatusColors[docStatus];
                        return (
                          <div key={key} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"#0F1117", borderRadius:8, padding:"10px 12px" }}>
                            <div>
                              <div style={{ fontSize:12, fontWeight:600 }}>{label}</div>
                              <div style={{ fontSize:11, color:dc.color, marginTop:2 }}>{dc.icon} {docStatus.charAt(0).toUpperCase()+docStatus.slice(1).replace("_"," ")}</div>
                            </div>
                            {docStatus !== "verified" && (
                              <button onClick={() => handleDocVerify(selectedRider.id, key)} style={{ background:"rgba(40,167,69,0.15)", border:"1px solid rgba(40,167,69,0.3)", color:"#28A745", padding:"4px 10px", borderRadius:6, fontSize:11, cursor:"pointer", fontWeight:600 }}>Verify</button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ marginTop:14, background:"rgba(102,126,234,0.08)", border:"1px solid rgba(102,126,234,0.2)", borderRadius:8, padding:"10px 12px" }}>
                      <div style={{ fontSize:10, color:"#667eea", marginBottom:6, fontWeight:700 }}>💡 How Uber handles this</div>
                      <div style={{ fontSize:11, color:"#A0A8C0", lineHeight:1.6 }}>Uber uses automated document scanning (OCR + AI) to verify IDs and licenses instantly. Insurance is checked against a national database. Background checks are outsourced to Checkr and take 3–5 days. Riders cannot go online until all docs are verified.</div>
                    </div>
                  </div>
                )}

                {/* TRIPS */}
                {riderTab==="trips" && (
                  <div style={{ background:"#13151E", borderRadius:10, padding:13 }}>
                    <div style={{ fontSize:10, color:"#555B75", marginBottom:10, textTransform:"uppercase", letterSpacing:"0.06em" }}>Recent Trips</div>
                    {selectedRider.recentTrips.length === 0
                      ? <div style={{ fontSize:12, color:"#555B75", textAlign:"center", padding:"20px 0" }}>No trips yet.</div>
                      : selectedRider.recentTrips.map((trip, i) => (
                        <div key={trip.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", borderBottom: i < selectedRider.recentTrips.length-1 ? "1px solid #1C1F2E" : "none" }}>
                          <div>
                            <div style={{ fontSize:12, fontWeight:600 }}>{trip.id}</div>
                            <div style={{ fontSize:11, color:"#7B8099" }}>{trip.customer} · {trip.time}</div>
                          </div>
                          <div style={{ textAlign:"right" }}>
                            <div style={{ fontSize:13, fontWeight:700, color:"#28A745" }}>{trip.amount}</div>
                            <div style={{ fontSize:10, color:"#28A745" }}>✅ Delivered</div>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}

                {/* NOTES */}
                {riderTab==="notes" && (
                  <div style={{ background:"#13151E", borderRadius:10, padding:13 }}>
                    <div style={{ fontSize:10, color:"#555B75", marginBottom:10, textTransform:"uppercase", letterSpacing:"0.06em" }}>Admin Notes</div>
                    <div style={{ fontSize:12, color:"#A0A8C0", background:"#0F1117", borderRadius:8, padding:"10px 12px", lineHeight:1.6, marginBottom:10 }}>
                      {selectedRider.notes || <span style={{ color:"#555B75" }}>No notes yet.</span>}
                    </div>
                    <textarea
                      value={riderNote}
                      onChange={e => setRiderNote(e.target.value)}
                      placeholder="Update admin notes..."
                      style={{ background:"#0F1117", border:"1px solid #252836", color:"#E8EAF0", borderRadius:8, padding:"9px 12px", fontSize:12, fontFamily:"inherit", minHeight:80, outline:"none", width:"100%", boxSizing:"border-box", resize:"vertical" }}
                    />
                    <button onClick={() => handleAddNote(selectedRider.id)} style={{ marginTop:8, background:"#667eea", border:"none", color:"#fff", padding:9, borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:13, width:"100%" }}>💾 Save Notes</button>
                  </div>
                )}
              </aside>
            )}
          </>
        )}

        {/* Placeholder tabs */}
        {!["orders","reports","riders"].includes(activeTab) && (
          <main style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:10, color:"#555B75", animation:"fadeIn 0.3s ease" }}>
            <div style={{ fontSize:44 }}>{navItems.find(n=>n[2]===activeTab)?.[0]}</div>
            <div style={{ fontSize:15, fontWeight:600, color:"#7B8099" }}>{navItems.find(n=>n[2]===activeTab)?.[1]}</div>
            <div style={{ fontSize:13 }}>Coming soon.</div>
          </main>
        )}
      </div>
    </div>
  );
}
