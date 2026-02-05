'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabase';
// Importamos las librerías para el PDF
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Plus, Save, X, Trash2, LogOut, User, ChevronLeft, ChevronRight, 
  Calendar, Gamepad2, Search, Loader2, RefreshCw, Box, Shield, 
  Megaphone, Settings, Tag, Eye, EyeOff, TrendingDown, 
  Activity, CheckCircle, XCircle, Play, Terminal 
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, LabelList 
} from 'recharts';

export default function Dashboard() {
  // --- ESTADOS DE USUARIO ---
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  // CAMPOS LOGIN
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  // --- ESTADOS DE DATOS ---
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [steamItems, setSteamItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  // ESTADOS DE UI GLOBAL
  const [privacyMode, setPrivacyMode] = useState(false);

  // MODALES
  const [showForm, setShowForm] = useState(false);
  const [showSteamForm, setShowSteamForm] = useState(false);
  const [showCatManager, setShowCatManager] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  
  const [editingLimit, setEditingLimit] = useState<{id: number, name: string, amount: number} | null>(null);

  const [systemAlert, setSystemAlert] = useState({ message: '', active: false });
  const [adminMessageInput, setAdminMessageInput] = useState('');
  const [newSteamItem, setNewSteamItem] = useState({ name: '', quantity: '', price: '' });
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [refreshingSteam, setRefreshingSteam] = useState(false);

  const [diagnosticLogs, setDiagnosticLogs] = useState<{msg: string, status: 'info'|'success'|'error'}[]>([]);
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  const [newItem, setNewItem] = useState({ name: '', amount: '', type: 'expense', category: '', date: new Date().toISOString().split('T')[0] });
  const [newCatForm, setNewCatForm] = useState({ name: '', color: '#3b82f6', is_income: false, budget_limit: '0' });

  // --- MÁQUINA DEL TIEMPO ---
  const [currentDate, setCurrentDate] = useState(new Date());
  const currentMonthIndex = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const goToPrevMonth = () => setCurrentDate(new Date(currentYear, currentMonthIndex - 1, 1));
  const goToNextMonth = () => setCurrentDate(new Date(currentYear, currentMonthIndex + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const currentMonthName = capitalize(currentDate.toLocaleString('es-ES', { month: 'long' }));
  const THEME = { bg: '#0d1117', card: '#161b22', text: '#ffffff' };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if(session) loadAllData(session.user.id);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if(session) loadAllData(session.user.id);
      else { setAllTransactions([]); setSteamItems([]); setCategories([]); }
    });
    fetchSystemAlert();
    return () => subscription.unsubscribe();
  }, []);

  async function loadAllData(userId: string) {
    await fetchCategories(userId);
    fetchTransactions();
    fetchSteamPortfolio();
  }

  // --- FUNCIÓN DE EXPORTACIÓN A PDF ---
  const exportMonthlyPDF = () => {
    const doc = new jsPDF();
    const title = `Informe Financiero: ${currentMonthName} ${currentYear}`;
    
    doc.setFontSize(18);
    doc.text(title, 14, 20);
    doc.setFontSize(10);
    doc.text(`Usuario: ${userName}`, 14, 28);
    doc.text(`Patrimonio Total: ${formatEuro(netWorth)}`, 14, 33);

    autoTable(doc, {
      startY: 40,
      head: [['Resumen', 'Valor']],
      body: [
        ['Ingresos Mes', formatEuro(income)],
        ['Gastos Mes', formatEuro(totalExpenses)],
        ['Balance', formatEuro(income - totalExpenses)],
        ['Steam Neto', formatEuro(steamNetValue)],
      ],
      headStyles: { fillStyle: [16, 27, 42] }
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [['Fecha', 'Concepto', 'Categoria', 'Importe']],
      body: currentMonthTransactions.map(t => [
        new Date(t.date).toLocaleDateString(),
        t.name,
        t.category,
        formatEuro(t.type === 'income' ? t.amount : -t.amount)
      ]),
      headStyles: { fillStyle: [40, 167, 69] }
    });

    doc.save(`Informe_${currentMonthName}_${currentYear}.pdf`);
  };

  async function fetchCategories(userId: string) {
    const { data } = await supabase.from('user_categories').select('*').order('created_at', { ascending: true });
    if (data) {
        setCategories(data);
        if (data.length > 0 && !newItem.category) setNewItem(prev => ({ ...prev, category: data[0].name }));
    }
  }

  async function handleCreateCategory() {
    if (!newCatForm.name || !session) return;
    await supabase.from('user_categories').insert([{ user_id: session.user.id, name: newCatForm.name, color: newCatForm.color, is_income: newCatForm.is_income, budget_limit: parseFloat(newCatForm.budget_limit) || 0 }]);
    setNewCatForm({ name: '', color: '#3b82f6', is_income: false, budget_limit: '0' });
    fetchCategories(session.user.id);
  }

  async function handleDeleteCategory(id: number, name: string) {
    if(confirm(`¿Borrar "${name}"?`)) {
      await supabase.from('user_categories').delete().eq('id', id);
      fetchCategories(session.user.id);
    }
  }

  async function handleUpdateLimit() {
    if (!editingLimit || !session) return;
    await supabase.from('user_categories').update({ budget_limit: editingLimit.amount }).eq('id', editingLimit.id);
    setEditingLimit(null);
    fetchCategories(session.user.id);
  }

  const parseSteamPrice = (priceStr: string) => {
    let clean = priceStr.replace('€', '').replace('$', '').replace(',', '.').trim();
    clean = clean.replace('--', '00').replace('-', '00');
    return parseFloat(clean);
  };

  async function getSteamPrice() {
    if(!newSteamItem.name) return;
    setFetchingPrice(true);
    try {
        const res = await fetch(`/api/steam?name=${encodeURIComponent(newSteamItem.name)}`);
        const data = await res.json();
        const p = data.lowest_price || data.median_price;
        if (p) setNewSteamItem(prev => ({ ...prev, price: parseSteamPrice(p).toString() }));
    } catch (e) {}
    setFetchingPrice(false);
  }

  async function refreshAllSteamPrices() {
    setRefreshingSteam(true);
    for (const item of steamItems) {
        const res = await fetch(`/api/steam?name=${encodeURIComponent(item.item_name)}`);
        const data = await res.json();
        const p = data.lowest_price || data.median_price;
        if (p) await supabase.from('steam_portfolio').update({ current_price: parseSteamPrice(p) }).eq('id', item.id);
    }
    fetchSteamPortfolio();
    setRefreshingSteam(false);
  }

  async function fetchTransactions() {
    const { data } = await supabase.from('transactions').select('*').order('date', { ascending: false });
    if (data) setAllTransactions(data);
  }

  async function handleAdd() {
    if (!newItem.name || !newItem.amount || !session) return;
    const selectedCat = categories.find(c => c.name === newItem.category);
    const type = selectedCat?.is_income ? 'income' : 'expense';
    await supabase.from('transactions').insert([{ user_id: session.user.id, name: newItem.name, amount: parseFloat(newItem.amount), type, category: newItem.category, date: new Date(newItem.date).toISOString() }]);
    setNewItem({ ...newItem, name: '', amount: '' }); setShowForm(false); fetchTransactions();
  }

  async function handleDelete(id: number) {
    if(confirm("¿Borrar?")) { await supabase.from('transactions').delete().eq('id', id); fetchTransactions(); }
  }

  async function fetchSteamPortfolio() {
    const { data } = await supabase.from('steam_portfolio').select('*');
    if (data) setSteamItems(data);
  }

  async function handleAddSteam() {
    await supabase.from('steam_portfolio').insert([{ user_id: session.user.id, item_name: newSteamItem.name, quantity: parseInt(newSteamItem.quantity), current_price: parseFloat(newSteamItem.price) }]);
    setShowSteamForm(false); fetchSteamPortfolio();
  }

  async function handleDeleteSteam(id: number) {
    if(confirm("¿Borrar caja?")) { await supabase.from('steam_portfolio').delete().eq('id', id); fetchSteamPortfolio(); }
  }

  async function fetchSystemAlert() {
    const { data } = await supabase.from('system_config').select('*').eq('key_name', 'global_alert').single();
    if (data) { setSystemAlert({ message: data.value, active: data.is_active }); setAdminMessageInput(data.value); }
  }

  async function handleSaveAlert(active: boolean) {
    await supabase.from('system_config').update({ value: adminMessageInput, is_active: active }).eq('key_name', 'global_alert');
    fetchSystemAlert();
  }

  const runDiagnostics = async () => {
    if (isDiagnosing) return;
    setIsDiagnosing(true);
    setDiagnosticLogs([]);
    const addLog = (msg: string, status: 'info'|'success'|'error' = 'info') => setDiagnosticLogs(prev => [...prev, { msg, status }]);
    
    addLog("Iniciando diagnóstico...", 'info');
    await new Promise(r => setTimeout(r, 600));
    const { data: { session: s } } = await supabase.auth.getSession();
    if (s) addLog("Sesión activa OK", 'success');
    else addLog("Error de sesión", 'error');
    
    addLog("Comprobando base de datos...", 'info');
    const { error } = await supabase.from('user_categories').select('id').limit(1);
    if (!error) addLog("DB Conectada", 'success');
    else addLog("Error de conexión DB", 'error');

    setIsDiagnosing(false);
  };

  async function handleAuth() {
    setLoading(true);
    if (authMode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
      if (error) alert(error.message); else alert("Creado.");
    }
    setLoading(false);
  }

  // --- CÁLCULOS ---
  const currentMonthTransactions = allTransactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === currentMonthIndex && d.getFullYear() === currentYear;
  });

  const income = currentMonthTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalExpenses = currentMonthTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const steamNetValue = steamItems.reduce((acc, i) => acc + (i.quantity * i.current_price), 0) * 0.85;
  const currentBalance = allTransactions.reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), 0);
  const netWorth = currentBalance + steamNetValue;

  const lastMonthDate = new Date(currentYear, currentMonthIndex - 1, 1);
  const lastMonthExpenses = allTransactions.filter(t => {
      const d = new Date(t.date);
      return t.type === 'expense' && d.getMonth() === lastMonthDate.getMonth() && d.getFullYear() === lastMonthDate.getFullYear();
  }).reduce((acc, t) => acc + t.amount, 0);

  const comparisonData = [{ name: 'Mes Pasado', amount: lastMonthExpenses }, { name: 'Este Mes', amount: totalExpenses }];

  const blurClass = privacyMode ? 'blur-[10px] select-none transition-all' : 'transition-all';
  const formatEuro = (amount: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
  const userName = session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0];
  const isAdmin = session?.user?.app_metadata?.role === 'admin';

  if (!session) return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0d1117]">
        <div className="bg-[#161b22] p-8 rounded-2xl border border-slate-800 w-full max-w-sm shadow-2xl text-white">
          <h1 className="text-3xl font-bold mb-6 text-center">Finanzas</h1>
          <div className="space-y-4">
            {authMode === 'register' && <input type="text" className="w-full bg-[#0d1117] border border-slate-700 rounded p-3 text-white" placeholder="Nombre" value={fullName} onChange={e => setFullName(e.target.value)} />}
            <input type="email" className="w-full bg-[#0d1117] border border-slate-700 rounded p-3 text-white" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
            <input type="password" className="w-full bg-[#0d1117] border border-slate-700 rounded p-3 text-white" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} />
            <button onClick={handleAuth} className="w-full bg-emerald-600 font-bold py-3 rounded-lg">{authMode === 'login' ? 'Entrar' : 'Registrarse'}</button>
            <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="w-full text-slate-400 text-sm underline">Cambiar modo</button>
          </div>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen font-sans text-white flex flex-col bg-[#0d1117]">
      {systemAlert.active && <div className="bg-amber-500/10 border-b border-amber-500/20 py-2 text-center text-amber-400 text-sm font-bold"><Megaphone className="inline mr-2" size={16}/>{systemAlert.message}</div>}

      <div className="flex-1 p-4 md:p-6 relative">
          <button onClick={() => setShowForm(true)} className="fixed bottom-8 right-8 z-50 bg-emerald-500 text-black font-bold p-4 rounded-full shadow-2xl hover:scale-110 transition-all"><Plus size={24} /></button>
          <div className="fixed bottom-8 left-8 z-50 flex gap-3"><button onClick={() => supabase.auth.signOut()} className="bg-[#1e293b] font-bold py-3 px-6 rounded-full border border-slate-600 flex gap-2"><LogOut size={18}/> Salir</button>{isAdmin && <button onClick={() => setShowAdminPanel(true)} className="bg-red-900/80 p-3 rounded-full border border-red-500/50"><Shield size={20}/></button>}</div>

          {/* GESTOR CATEGORÍAS */}
          {showCatManager && (
             <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
                <div className="bg-[#1e293b] p-6 rounded-2xl w-full max-w-lg border border-slate-700 relative">
                    <div className="flex justify-between mb-4 border-b border-slate-700 pb-2"><h3 className="font-bold text-xl flex gap-2"><Settings/> Configurar Categorías</h3><button onClick={() => setShowCatManager(false)}><X/></button></div>
                    <div className="space-y-2 mb-6 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                        {categories.map(cat => (
                            <div key={cat.id} className="flex justify-between items-center bg-[#0d1117] p-3 rounded border border-slate-800">
                                <div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full" style={{backgroundColor: cat.color}}></div><div><p className="font-bold text-sm">{cat.name}</p><p className="text-[10px] text-slate-400">{cat.is_income ? 'Meta' : 'Límite'}: {formatEuro(cat.budget_limit)}</p></div></div>
                                <button onClick={() => handleDeleteCategory(cat.id, cat.name)} className="text-slate-600 hover:text-rose-500"><Trash2 size={16}/></button>
                            </div>
                        ))}
                    </div>
                    <div className="bg-[#0f172a] p-4 rounded-lg border border-slate-700 space-y-3">
                        <div className="grid grid-cols-2 gap-2"><input className="bg-[#1e293b] border border-slate-600 rounded p-2 text-sm" placeholder="Nombre" value={newCatForm.name} onChange={e => setNewCatForm({...newCatForm, name: e.target.value})}/><input type="number" className="bg-[#1e293b] border border-slate-600 rounded p-2 text-sm" placeholder="Importe" value={newCatForm.budget_limit} onChange={e => setNewCatForm({...newCatForm, budget_limit: e.target.value})}/></div>
                        <div className="flex justify-between items-center"><input type="color" value={newCatForm.color} onChange={e => setNewCatForm({...newCatForm, color: e.target.value})}/><button onClick={handleCreateCategory} className="bg-emerald-600 px-4 py-2 rounded text-sm font-bold">Añadir</button></div>
                    </div>
                </div>
             </div>
          )}

          {/* MODAL ADMIN */}
          {showAdminPanel && (
            <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4">
               <div className="bg-[#1e293b] p-6 rounded-2xl w-full max-w-2xl border border-red-500/30 flex flex-col max-h-[90vh]">
                  <div className="flex justify-between mb-6 border-b border-slate-700 pb-4"><h3 className="font-bold text-xl text-red-400 flex items-center gap-2"><Shield size={24}/> Admin Panel</h3><button onClick={() => setShowAdminPanel(false)}><X/></button></div>
                  <div className="overflow-y-auto space-y-6">
                      <div className="space-y-4"><h4 className="text-white font-bold flex items-center gap-2"><Megaphone size={18} className="text-amber-400"/> Aviso Global</h4><textarea className="w-full bg-[#0f172a] border border-slate-600 rounded p-3 h-20 text-sm" value={adminMessageInput} onChange={(e) => setAdminMessageInput(e.target.value)}/><div className="flex gap-2"><button onClick={() => handleSaveAlert(true)} className="flex-1 bg-emerald-600/20 text-emerald-400 border border-emerald-600/50 py-2 rounded font-bold">Publicar</button><button onClick={() => handleSaveAlert(false)} className="flex-1 bg-slate-700/20 text-slate-400 border border-slate-600/50 py-2 rounded font-bold">Ocultar</button></div></div>
                      <div className="space-y-4 pt-4 border-t border-slate-700"><div className="flex justify-between items-center"><h4 className="text-white font-bold flex items-center gap-2"><Activity size={18} className="text-sky-400"/> Consola</h4><button onClick={runDiagnostics} className="bg-sky-600 px-3 py-1 rounded text-xs font-bold">Test</button></div><div className="bg-black p-4 rounded h-64 overflow-y-auto font-mono text-xs">{diagnosticLogs.map((log, i) => <div key={i} className={log.status === 'success' ? 'text-emerald-400' : log.status === 'error' ? 'text-rose-500' : 'text-blue-400'}>{log.msg}</div>)}</div></div>
                  </div>
               </div>
            </div>
          )}

          {/* MODAL TRANSACCION */}
          {showForm && (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
              <div className="bg-[#1e293b] p-6 rounded-2xl w-full max-w-md border border-slate-700 space-y-4">
                <div className="flex justify-between"><h3 className="font-bold">Añadir Movimiento</h3><button onClick={() => setShowForm(false)}><X/></button></div>
                <input type="date" className="w-full bg-[#0f172a] border border-slate-600 rounded p-3" value={newItem.date} onChange={e => setNewItem({...newItem, date: e.target.value})} />
                <input className="w-full bg-[#0f172a] border border-slate-600 rounded p-3" placeholder="Concepto" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})}/>
                <input type="number" className="w-full bg-[#0f172a] border border-slate-600 rounded p-3" placeholder="Importe" value={newItem.amount} onChange={e => setNewItem({...newItem, amount: e.target.value})}/>
                <select className="w-full bg-[#0f172a] border border-slate-600 rounded p-3" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})}>{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select>
                <button onClick={handleAdd} className="w-full bg-emerald-500 text-black font-bold py-3 rounded-lg">Guardar</button>
              </div>
            </div>
          )}

          {/* LAYOUT PRINCIPAL */}
          <div className="max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-6 pb-20">
            <div className="md:col-span-12 bg-[#161b22] p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="bg-slate-800 p-3 rounded-full"><User className={isAdmin ? "text-red-500" : "text-emerald-400"} size={24} /></div>
                    <div><p className="text-slate-400 text-xs">Bienvenido</p><h2 className="text-lg font-bold">{userName}</h2></div>
                    <button onClick={() => setShowCatManager(true)} className="bg-slate-800 p-2 rounded-lg text-slate-300 border border-slate-700 flex gap-2 text-xs"><Tag size={14}/> Categorías</button>
                    <button onClick={() => setPrivacyMode(!privacyMode)} className="bg-slate-800 p-2 rounded-lg border border-slate-700 text-slate-300">{privacyMode ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
                </div>
                <div className="text-right hidden md:block"><p className="text-slate-400 text-xs">Patrimonio Total</p><h2 className={`text-2xl font-bold text-emerald-400 ${blurClass}`}>{formatEuro(netWorth)}</h2></div>
            </div>

            <div className="md:col-span-3 space-y-4">
              <div className="bg-[#161b22] p-6 rounded-xl border border-slate-800 text-center relative select-none">
                <button onClick={goToPrevMonth} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 text-slate-400"><ChevronLeft size={24} /></button>
                <button onClick={goToNextMonth} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400"><ChevronRight size={24} /></button>
                <h1 className="text-3xl font-light">{currentMonthName}</h1>
                <p className="text-slate-500 text-xs">{currentYear}</p>
              </div>
              <div className="bg-[#161b22] p-4 rounded-xl border border-slate-800 flex justify-between items-center"><span className="text-slate-400 text-xs">Saldo Líquido</span><span className={`font-mono font-bold ${blurClass}`}>{formatEuro(currentBalance)}</span></div>
              <div className="bg-[#161b22] p-4 rounded-xl border border-slate-800 flex justify-between items-center"><span className="text-sky-400 text-xs">Steam Neto</span><span className={`font-mono font-bold ${blurClass}`}>{formatEuro(steamNetValue)}</span></div>
              
              {/* COMPARATIVA GASTOS */}
              <div className="bg-[#161b22] p-4 rounded-xl border border-slate-800 h-[140px]">
                 <h3 className="font-bold text-xs mb-2 flex gap-2"><TrendingDown size={14} className="text-rose-500"/> Comparativa</h3>
                 <ResponsiveContainer width="100%" height={80}>
                    <BarChart layout="vertical" data={comparisonData} margin={{ left: 40 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false}/>
                        <Bar dataKey="amount" fill="#f43f5e" barSize={20} radius={[0, 4, 4, 0]}>
                            <LabelList dataKey="amount" position="right" fontSize={10} fill="#fff" formatter={(val:any) => privacyMode ? '****' : formatEuro(val)}/>
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="md:col-span-5 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4 h-24">
                    <div className="bg-[#161b22] p-4 rounded-xl border border-slate-800 relative overflow-hidden"><div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div><p className="text-emerald-500 text-[10px] font-bold">INGRESOS</p><h2 className={`text-xl font-bold ${blurClass}`}>{formatEuro(income)}</h2></div>
                    <div className="bg-[#161b22] p-4 rounded-xl border border-slate-800 relative overflow-hidden"><div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div><p className="text-rose-500 text-[10px] font-bold">GASTOS</p><h2 className={`text-xl font-bold ${blurClass}`}>{formatEuro(totalExpenses)}</h2></div>
                </div>
                <div className="bg-[#161b22] p-4 rounded-xl border border-slate-800 flex-1 flex flex-col max-h-[280px]">
                    <div className="flex justify-between items-center mb-4"><h3 className="font-bold flex gap-2"><Gamepad2 className="text-sky-400"/> Steam</h3><button onClick={() => setShowSteamForm(true)} className="text-[10px] bg-sky-500/10 text-sky-400 px-2 py-1 rounded">+ Caja</button></div>
                    <div className="grid grid-cols-2 gap-2 overflow-y-auto custom-scrollbar">
                        {steamItems.map(item => (
                            <div key={item.id} className="bg-[#0d1117] p-2 rounded border border-slate-800 relative group h-20 flex flex-col justify-between">
                                <button onClick={() => handleDeleteSteam(item.id)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100"><Trash2 size={10}/></button>
                                <p className="text-[10px] truncate">{item.item_name}</p>
                                <p className={`text-xs font-bold text-sky-400 ${blurClass}`}>{formatEuro(item.quantity * item.current_price * 0.85)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="md:col-span-4 bg-[#161b22] rounded-xl border border-slate-800 p-4 flex flex-col h-[400px]">
                <div className="flex justify-between items-center mb-4"><h3 className="font-bold flex gap-2"><Calendar className="text-slate-400"/> Historial</h3><button onClick={exportMonthlyPDF} className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded border border-emerald-500/30 font-bold">PDF</button></div>
                <div className="overflow-y-auto flex-1 space-y-2 custom-scrollbar">
                    {currentMonthTransactions.map(t => (
                        <div key={t.id} className="flex justify-between items-center p-2 rounded bg-[#0d1117] border border-slate-800 group text-xs">
                            <div><p className="font-medium">{t.name}</p><p className="text-[9px] text-slate-500">{t.category}</p></div>
                            <div className="flex gap-2"><span className={`${t.type==='income'?'text-emerald-400':'text-rose-500'} ${blurClass}`}>{formatEuro(t.type === 'income' ? t.amount : -t.amount)}</span><button onClick={() => handleDelete(t.id)} className="opacity-0 group-hover:opacity-100"><Trash2 size={12}/></button></div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="md:col-span-12 grid grid-cols-2 md:grid-cols-5 gap-4">
                {categories.map((cat) => {
                    const used = currentMonthTransactions.filter(t => t.category === cat.name && t.type === (cat.is_income ? 'income' : 'expense')).reduce((acc, t) => acc + t.amount, 0);
                    const limit = cat.budget_limit || 0;
                    const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
                    return (
                        <div key={cat.id} className="bg-[#161b22] p-4 rounded-xl border border-slate-800 flex flex-col items-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1" style={{backgroundColor: cat.color}}></div>
                            <h3 className="text-xs font-bold mb-1 uppercase truncate w-full text-center" style={{color: cat.color}}>{cat.name}</h3>
                            <div className="w-16 h-16 relative mb-2">
                                <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{v:used||1},{v:Math.max(limit-used,0)}]} cx="50%" cy="50%" innerRadius={20} outerRadius={26} startAngle={90} endAngle={-270} dataKey="v" stroke="none"><Cell fill={cat.color}/><Cell fill="#30363d"/></Pie></PieChart></ResponsiveContainer>
                                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">{pct.toFixed(0)}%</div>
                            </div>
                            <p className={`text-lg font-bold ${blurClass}`}>{formatEuro(used)}</p>
                            <button onClick={() => setEditingLimit({id: cat.id, name: cat.name, amount: limit})} className="text-[9px] text-slate-500 mt-1">Límite: <span className={blurClass}>{formatEuro(limit)}</span></button>
                        </div>
                    )
                })}
            </div>
          </div>
      </div>
      <style jsx global>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #30363d; border-radius: 4px; }`}</style>
    </div>
  );
}
