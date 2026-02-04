'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabase';
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
  
  // ESTADO CORE: CATEGORÍAS DEL USUARIO
  const [categories, setCategories] = useState<any[]>([]);

  // ESTADOS DE UI GLOBAL
  const [privacyMode, setPrivacyMode] = useState(false);

  // MODALES
  const [showForm, setShowForm] = useState(false);
  const [showSteamForm, setShowSteamForm] = useState(false);
  const [showCatManager, setShowCatManager] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  
  // EDICIÓN RÁPIDA DE LÍMITE
  const [editingLimit, setEditingLimit] = useState<{id: number, name: string, amount: number} | null>(null);

  // ESTADOS ADMIN Y STEAM
  const [systemAlert, setSystemAlert] = useState({ message: '', active: false });
  const [adminMessageInput, setAdminMessageInput] = useState('');
  const [newSteamItem, setNewSteamItem] = useState({ name: '', quantity: '', price: '' });
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [refreshingSteam, setRefreshingSteam] = useState(false);

  // ESTADOS DIAGNÓSTICO
  const [diagnosticLogs, setDiagnosticLogs] = useState<{msg: string, status: 'info'|'success'|'error'}[]>([]);
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  // ESTADOS FORMULARIOS
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

  // 1. CARGA INICIAL
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

  // --- LÓGICA DE CATEGORÍAS ---
  async function fetchCategories(userId: string) {
    const { data } = await supabase.from('user_categories').select('*').order('created_at', { ascending: true });
    
    if (data) {
        setCategories(data);
        if (data.length > 0 && !newItem.category) {
            setNewItem(prev => ({ ...prev, category: data[0].name }));
        }
    }
  }

  async function handleCreateCategory() {
    if (!newCatForm.name || !session) return;
    const { error } = await supabase.from('user_categories').insert([{
        user_id: session.user.id,
        name: newCatForm.name,
        color: newCatForm.color,
        is_income: newCatForm.is_income,
        budget_limit: parseFloat(newCatForm.budget_limit) || 0
    }]);

    if (!error) {
        setNewCatForm({ name: '', color: '#3b82f6', is_income: false, budget_limit: '0' });
        fetchCategories(session.user.id);
    } else {
        alert("Error creando categoría: " + error.message);
    }
  }

  async function handleDeleteCategory(id: number, name: string) {
    if(!confirm(`¿Borrar categoría "${name}"?`)) return;
    const { error } = await supabase.from('user_categories').delete().eq('id', id);
    if (!error) fetchCategories(session.user.id);
  }

  async function handleUpdateLimit() {
    if (!editingLimit || !session) return;
    const { error } = await supabase.from('user_categories')
        .update({ budget_limit: editingLimit.amount })
        .eq('id', editingLimit.id);
    
    if (!error) {
        setEditingLimit(null);
        fetchCategories(session.user.id);
    }
  }

  // --- LÓGICA STEAM Y TRANSACCIONES ---
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
    const updates = steamItems.map(async (item) => {
        const res = await fetch(`/api/steam?name=${encodeURIComponent(item.item_name)}`);
        const data = await res.json();
        const p = data.lowest_price || data.median_price;
        if (p) await supabase.from('steam_portfolio').update({ current_price: parseSteamPrice(p) }).eq('id', item.id);
    });
    await Promise.all(updates);
    fetchSteamPortfolio();
    setRefreshingSteam(false);
  }

  async function fetchTransactions() {
    const { data } = await supabase.from('transactions').select('*').order('date', { ascending: false });
    if (data) setAllTransactions(data);
  }

  async function handleAdd() {
    if (!newItem.name || !newItem.amount || !session) return;
    if (categories.length === 0) { alert("¡Crea una categoría primero!"); return; }
    
    const selectedCat = categories.find(c => c.name === newItem.category);
    const type = selectedCat ? (selectedCat.is_income ? 'income' : 'expense') : newItem.type;

    const { error } = await supabase.from('transactions').insert([{ 
      user_id: session.user.id, name: newItem.name, amount: parseFloat(newItem.amount), 
      type: type, category: newItem.category, date: new Date(newItem.date).toISOString() 
    }]);
    if (!error) { setNewItem({ ...newItem, name: '', amount: '' }); setShowForm(false); fetchTransactions(); }
  }

  async function handleDelete(id: number) {
    if(confirm("¿Borrar?")) {
        await supabase.from('transactions').delete().eq('id', id);
        fetchTransactions();
    }
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

  // --- ADMIN & DIAGNÓSTICO ---
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

    const addLog = (msg: string, status: 'info'|'success'|'error' = 'info') => {
        setDiagnosticLogs(prev => [...prev, { msg, status }]);
    };

    try {
        addLog("Iniciando sistema de diagnóstico v1.0...", 'info');
        await new Promise(r => setTimeout(r, 600));

        addLog("Verificando integridad de sesión...", 'info');
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) addLog(`Sesión válida. UID: ${currentSession.user.id.slice(0, 8)}...`, 'success');
        else throw new Error("No hay sesión activa");
        await new Promise(r => setTimeout(r, 600));

        addLog("Testeando latencia DB (Supabase)...", 'info');
        const start = performance.now();
        const { error: dbError } = await supabase.from('user_categories').select('count', { count: 'exact', head: true });
        const end = performance.now();
        if (dbError) throw new Error("Fallo conexión DB: " + dbError.message);
        addLog(`Conexión DB estable (${(end - start).toFixed(2)}ms)`, 'success');
        await new Promise(r => setTimeout(r, 600));

        addLog("Conectando con Steam Market...", 'info');
        try {
            const res = await fetch('/api/steam?name=Recoil%20Case');
            if (res.status === 200) {
                const data = await res.json();
                if(data.lowest_price || data.median_price) addLog("API Steam respondiendo correctamente.", 'success');
                else addLog("API Steam conecta pero sin precio.", 'error');
            } else {
                addLog(`Error HTTP Steam: ${res.status}`, 'error');
            }
        } catch (e) { addLog("Fallo crítico API Steam.", 'error'); }
        await new Promise(r => setTimeout(r, 600));

        addLog("Diagnóstico finalizado.", 'info');

    } catch (error: any) {
        addLog(error.message || "Error desconocido", 'error');
    } finally {
        setIsDiagnosing(false);
    }
  };

  async function handleAuth() {
    setLoading(true);
    if (authMode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert(error.message);
    } else {
      if (!fullName) { alert("Nombre requerido"); setLoading(false); return; }
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
      if (error) alert(error.message); else alert("Creado. Inicia sesión.");
    }
    setLoading(false);
  }

  // --- CÁLCULOS GENERALES ---
  const currentMonthTransactions = allTransactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === currentMonthIndex && d.getFullYear() === currentYear;
  });

  const income = currentMonthTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalExpenses = currentMonthTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const steamNetValue = steamItems.reduce((acc, i) => acc + (i.quantity * i.current_price), 0) * 0.85;
  
  const startBalance = allTransactions.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() < currentYear || (d.getFullYear() === currentYear && d.getMonth() < currentMonthIndex);
  }).reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), 0);
  
  const currentBalance = startBalance + (income - totalExpenses);
  const netWorth = currentBalance + steamNetValue;

  // --- COMPARATIVA MENSUAL ---
  const lastMonthDate = new Date(currentYear, currentMonthIndex - 1, 1);
  const lastMonthIdx = lastMonthDate.getMonth();
  const lastMonthYearIdx = lastMonthDate.getFullYear();
  
  const lastMonthExpenses = allTransactions
      .filter(t => {
          const d = new Date(t.date);
          return t.type === 'expense' && d.getMonth() === lastMonthIdx && d.getFullYear() === lastMonthYearIdx;
      })
      .reduce((acc, t) => acc + t.amount, 0);

  const comparisonData = [
    { name: 'Mes Pasado', amount: lastMonthExpenses },
    { name: 'Este Mes', amount: totalExpenses },
  ];

  // --- FORMATO ---
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
    <div className="min-h-screen font-sans text-white relative flex flex-col bg-[#0d1117]">
      {systemAlert.active && <div className="bg-amber-500/10 border-b border-amber-500/20 py-2 text-center text-amber-400 text-sm font-bold"><Megaphone className="inline mr-2" size={16}/>{systemAlert.message}</div>}

      <div className="flex-1 p-4 md:p-6 relative">
          <button onClick={() => setShowForm(true)} className="fixed bottom-8 right-8 z-50 bg-emerald-500 text-black font-bold p-4 rounded-full shadow-2xl hover:scale-110 transition-all"><Plus size={24} /></button>
          <div className="fixed bottom-8 left-8 z-50 flex gap-3"><button onClick={() => supabase.auth.signOut()} className="bg-[#1e293b] font-bold py-3 px-6 rounded-full border border-slate-600 flex gap-2"><LogOut size={18}/> Salir</button>{isAdmin && <button onClick={() => setShowAdminPanel(true)} className="bg-red-900/80 p-3 rounded-full border border-red-500/50"><Shield size={20}/></button>}</div>

          {/* GESTOR DE CATEGORÍAS */}
          {showCatManager && (
             <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
                <div className="bg-[#1e293b] p-6 rounded-2xl w-full max-w-lg border border-slate-700 relative">
                    <div className="flex justify-between mb-4 border-b border-slate-700 pb-2"><h3 className="font-bold text-xl flex gap-2"><Settings/> Configurar Categorías</h3><button onClick={() => setShowCatManager(false)}><X/></button></div>
                    
                    {categories.length === 0 ? (
                        <p className="text-slate-500 text-center py-4 italic">No tienes categorías. ¡Crea una!</p>
                    ) : (
                        <div className="space-y-2 mb-6 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                            {categories.map(cat => (
                                <div key={cat.id} className="flex justify-between items-center bg-[#0d1117] p-3 rounded border border-slate-800">
                                    <div className="flex items-center gap-3">
                                        <div className="w-4 h-4 rounded-full" style={{backgroundColor: cat.color}}></div>
                                        <div>
                                            <p className="font-bold text-sm">{cat.name}</p>
                                            <p className="text-[10px] text-slate-400">
                                                {cat.is_income ? `Meta: ${formatEuro(cat.budget_limit)}` : `Límite: ${formatEuro(cat.budget_limit)}`} • {cat.is_income ? 'Ingreso' : 'Gasto'}
                                            </p>
                                        </div>
                                    </div>
                                    <button onClick={() => handleDeleteCategory(cat.id, cat.name)} className="text-slate-600 hover:text-rose-500"><Trash2 size={16}/></button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="bg-[#0f172a] p-4 rounded-lg border border-slate-700">
                        <p className="text-xs text-slate-400 mb-2 uppercase font-bold">Crear Nueva Categoría</p>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <input className="bg-[#1e293b] border border-slate-600 rounded p-2 text-sm" placeholder="Nombre (ej: Ahorro)" value={newCatForm.name} onChange={e => setNewCatForm({...newCatForm, name: e.target.value})}/>
                            <div className="flex gap-2">
                                <input type="number" className="flex-1 bg-[#1e293b] border border-slate-600 rounded p-2 text-sm" placeholder="Meta/Límite" value={newCatForm.budget_limit} onChange={e => setNewCatForm({...newCatForm, budget_limit: e.target.value})}/>
                                <input type="color" className="w-10 h-full bg-transparent border-none cursor-pointer" value={newCatForm.color} onChange={e => setNewCatForm({...newCatForm, color: e.target.value})}/>
                            </div>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
                                <input type="checkbox" checked={newCatForm.is_income} onChange={e => setNewCatForm({...newCatForm, is_income: e.target.checked})}/> Es tipo Ingreso (Ahorro/Nómina)
                            </label>
                            <button onClick={handleCreateCategory} className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded text-sm font-bold flex items-center gap-2"><Plus size={14}/> Crear</button>
                        </div>
                    </div>
                </div>
             </div>
          )}

          {/* MODAL ADMIN & DIAGNÓSTICO */}
          {showAdminPanel && (
            <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4">
               <div className="bg-[#1e293b] p-6 rounded-2xl w-full max-w-2xl border border-red-500/30 flex flex-col max-h-[90vh]">
                  
                  <div className="flex justify-between mb-6 border-b border-slate-700 pb-4">
                      <h3 className="font-bold text-xl text-red-400 flex items-center gap-2">
                          <Shield size={24}/> Panel de Control - Admin
                      </h3>
                      <button onClick={() => setShowAdminPanel(false)}><X className="text-slate-400 hover:text-white"/></button>
                  </div>

                  <div className="overflow-y-auto pr-2 custom-scrollbar space-y-8">
                      <div className="space-y-4">
                          <h4 className="text-white font-bold flex items-center gap-2"><Megaphone size={18} className="text-amber-400"/> Gestión de Avisos</h4>
                          <textarea className="w-full bg-[#0f172a] border border-slate-600 rounded p-3 text-white h-20 resize-none text-sm" placeholder="Mensaje para los usuarios..." value={adminMessageInput} onChange={(e) => setAdminMessageInput(e.target.value)}/>
                          <div className="flex gap-2">
                              <button onClick={() => handleSaveAlert(true)} className="flex-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-600/50 py-2 rounded font-bold text-xs uppercase tracking-wider">Publicar</button>
                              <button onClick={() => handleSaveAlert(false)} className="flex-1 bg-slate-700/20 hover:bg-slate-700/40 text-slate-400 border border-slate-600/50 py-2 rounded font-bold text-xs uppercase tracking-wider">Ocultar</button>
                          </div>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-slate-700">
                          <div className="flex justify-between items-center">
                              <h4 className="text-white font-bold flex items-center gap-2"><Activity size={18} className="text-sky-400"/> Diagnóstico del Sistema</h4>
                              <button onClick={runDiagnostics} disabled={isDiagnosing} className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-bold uppercase tracking-wider transition-all ${isDiagnosing ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-sky-600 hover:bg-sky-500 text-white'}`}>
                                  {isDiagnosing ? <Loader2 className="animate-spin" size={14}/> : <Play size={14}/>} Ejecutar Test
                              </button>
                          </div>
                          <div className="w-full bg-black rounded-lg border border-slate-700 p-4 font-mono text-xs h-64 overflow-y-auto custom-scrollbar shadow-inner shadow-black/50">
                              {diagnosticLogs.length === 0 ? (
                                  <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2 opacity-50"><Terminal size={32}/><p>Esperando ejecución...</p></div>
                              ) : (
                                  <div className="space-y-1">
                                      {diagnosticLogs.map((log, i) => (
                                          <div key={i} className="flex gap-2 items-start animate-in fade-in slide-in-from-left-2 duration-300">
                                              <span className="text-slate-500">[{new Date().toLocaleTimeString().split(' ')[0]}]</span>
                                              {log.status === 'info' && <span className="text-blue-400">{log.msg}</span>}
                                              {log.status === 'success' && <span className="text-emerald-400 flex items-center gap-1"><CheckCircle size={12}/> {log.msg}</span>}
                                              {log.status === 'error' && <span className="text-rose-500 flex items-center gap-1 font-bold"><XCircle size={12}/> {log.msg}</span>}
                                          </div>
                                      ))}
                                      {isDiagnosing && <span className="inline-block w-2 h-4 bg-emerald-500 animate-pulse align-middle ml-1"></span>}
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>
               </div>
            </div>
          )}

          {/* MODAL TRANSACCION */}
          {showForm && (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
              <div className="bg-[#1e293b] p-6 rounded-2xl w-full max-w-md border border-slate-700">
                <div className="flex justify-between mb-4"><h3 className="font-bold">Añadir Movimiento</h3><button onClick={() => setShowForm(false)}><X/></button></div>
                <div className="space-y-4">
                  <input type="date" className="w-full bg-[#0f172a] border border-slate-600 rounded p-3 text-white" value={newItem.date} onChange={e => setNewItem({...newItem, date: e.target.value})} />
                  <input className="w-full bg-[#0f172a] border border-slate-600 rounded p-3 text-white" placeholder="Concepto" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})}/>
                  <input type="number" className="w-full bg-[#0f172a] border border-slate-600 rounded p-3 text-white" placeholder="Cantidad" value={newItem.amount} onChange={e => setNewItem({...newItem, amount: e.target.value})}/>
                  <div className="grid grid-cols-2 gap-2">
                     <div className="bg-[#0f172a] border border-slate-600 rounded p-3 text-slate-400 text-center text-sm flex items-center justify-center">
                        {categories.find(c => c.name === newItem.category)?.is_income ? 'Ingreso (+)' : 'Gasto (-)'}
                     </div>
                    {categories.length > 0 ? (
                        <select className="bg-[#0f172a] border border-slate-600 rounded p-3 text-white" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})}>
                            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                    ) : (
                        <div className="bg-rose-900/20 text-rose-400 p-3 rounded text-xs border border-rose-500/30">Crea una categoría primero</div>
                    )}
                  </div>
                  <button onClick={handleAdd} className="w-full bg-emerald-500 text-black font-bold py-3 rounded-lg">Guardar</button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL EDITAR LÍMITE RÁPIDO */}
          {editingLimit && (
            <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4">
              <div className="bg-[#1e293b] p-6 rounded-2xl w-full max-w-xs border border-slate-700 text-center">
                 <h3 className="font-bold mb-4">{editingLimit.amount > 0 ? 'Editar Objetivo' : 'Establecer Objetivo'}</h3>
                 <p className="text-sky-400 text-sm font-bold mb-2">{editingLimit.name}</p>
                 <input autoFocus type="number" className="w-full bg-[#0d1117] border border-slate-700 rounded p-3 text-white text-xl mb-4 text-center" value={editingLimit.amount} onChange={e => setEditingLimit({...editingLimit, amount: parseFloat(e.target.value) || 0})}/>
                 <div className="flex gap-2">
                    <button onClick={() => setEditingLimit(null)} className="flex-1 bg-slate-700 py-2 rounded">Cancelar</button>
                    <button onClick={handleUpdateLimit} className="flex-1 bg-emerald-600 py-2 rounded font-bold">Guardar</button>
                 </div>
              </div>
            </div>
          )}
           
           {/* MODAL STEAM */}
           {showSteamForm && (
            <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4">
              <div className="bg-[#1e293b] p-6 rounded-2xl w-full max-w-md border border-slate-700">
                <div className="flex justify-between mb-4"><h3 className="font-bold text-sky-400">Añadir Caja CS</h3><button onClick={() => setShowSteamForm(false)}><X/></button></div>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input className="w-full bg-[#0f172a] border border-slate-600 rounded p-3 text-white" placeholder="Market Hash Name" value={newSteamItem.name} onChange={e => setNewSteamItem({...newSteamItem, name: e.target.value})} onBlur={getSteamPrice} />
                    <button onClick={getSteamPrice} disabled={fetchingPrice} className="bg-sky-500/20 text-sky-400 p-3 rounded border border-sky-500/50">{fetchingPrice ? <Loader2 className="animate-spin" size={20}/> : <Search size={20}/>}</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" className="w-full bg-[#0f172a] border border-slate-600 rounded p-3 text-white" placeholder="Cantidad" value={newSteamItem.quantity} onChange={e => setNewSteamItem({...newSteamItem, quantity: e.target.value})}/>
                    <input type="number" className="w-full bg-[#0f172a] border border-slate-600 rounded p-3 text-white" placeholder="Precio Unidad (€)" value={newSteamItem.price} onChange={e => setNewSteamItem({...newSteamItem, price: e.target.value})}/>
                  </div>
                  <button onClick={handleAddSteam} className="w-full bg-sky-500 text-black font-bold py-3 rounded-lg">Guardar en Cartera</button>
                </div>
              </div>
            </div>
          )}

          {/* LAYOUT PRINCIPAL */}
          <div className="max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-6 pb-20">
            <div className="md:col-span-12 bg-[#161b22] p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="bg-slate-800 p-3 rounded-full"><User className={isAdmin ? "text-red-500" : "text-emerald-400"} size={24} /></div>
                    <div><p className="text-slate-400 text-xs uppercase tracking-wider">Bienvenido</p><h2 className={`text-lg font-bold ${isAdmin ? 'text-red-500' : 'text-white'}`}>{userName} {isAdmin && "(Admin)"}</h2></div>
                    <button onClick={() => setShowCatManager(true)} className="ml-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg border border-slate-700 flex items-center gap-2 text-xs transition"><Settings size={14}/> Categorías</button>
                    <button onClick={() => setPrivacyMode(!privacyMode)} className="ml-2 bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-lg border border-slate-700 flex items-center transition" title={privacyMode ? "Mostrar valores" : "Ocultar valores"}>
                        {privacyMode ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                </div>
                <div className="text-right hidden md:block"><p className="text-slate-400 text-xs">Patrimonio Total</p><h2 className={`text-2xl font-bold ${isAdmin ? 'text-white-500' : 'text-emerald-400'} ${blurClass}`}>{formatEuro(netWorth)}</h2></div>
            </div>

            <div className="md:col-span-3 space-y-4">
              <div className="bg-[#161b22] p-6 rounded-xl border border-slate-800 text-center relative select-none">
                <button onClick={goToPrevMonth} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition"><ChevronLeft size={24} /></button>
                <button onClick={goToNextMonth} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition"><ChevronRight size={24} /></button>
                <h1 className="text-3xl font-light text-white cursor-pointer" onClick={goToToday}>{currentMonthName}</h1>
                <p className="text-slate-500 text-xs mt-1">- {currentYear} -</p>
              </div>
              <div className="bg-[#161b22] p-4 rounded-xl border border-slate-800 flex justify-between items-center"><span className="text-slate-400 text-xs">Saldo Líquido</span><span className={`text-white font-mono font-bold ${blurClass}`}>{formatEuro(currentBalance)}</span></div>
              <div className="bg-[#161b22] p-4 rounded-xl border border-slate-800 flex justify-between items-center"><span className="text-sky-400 text-xs">Steam Neto</span><span className={`text-white font-mono font-bold ${blurClass}`}>{formatEuro(steamNetValue)}</span></div>

              {/* COMPARATIVA MENSUAL (AJUSTADA) */}
              <div className="bg-[#161b22] p-4 rounded-xl border border-slate-800 h-[140px]">
                 <h3 className="font-bold text-white text-xs mb-2 flex gap-2 items-center"><TrendingDown size={14} className="text-rose-500"/> Comparativa</h3>
                 <ResponsiveContainer width="100%" height={80}>
                    <BarChart layout="vertical" data={comparisonData} margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
                        <RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '8px'}} itemStyle={{color: '#fff', fontSize:'12px'}} formatter={(value) => formatEuro(value as number)}/>
                        <Bar dataKey="amount" fill="#f43f5e" radius={[0, 4, 4, 0]} barSize={24}>
                           <LabelList dataKey="amount" position="right" fill="#fff" fontSize={10} formatter={(val: number) => privacyMode ? '****' : formatEuro(val)}/>
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="md:col-span-5 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#161b22] p-4 rounded-xl border border-slate-800 relative overflow-hidden"><div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div><h3 className="text-emerald-400 text-xs font-medium">INGRESOS MES</h3><h2 className={`text-2xl font-bold text-white ${blurClass}`}>{formatEuro(income)}</h2></div>
                    <div className="bg-[#161b22] p-4 rounded-xl border border-slate-800 relative overflow-hidden"><div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div><h3 className="text-rose-500 text-xs font-medium">GASTOS MES</h3><h2 className={`text-2xl font-bold text-white ${blurClass}`}>{formatEuro(totalExpenses)}</h2></div>
                </div>

                {/* STEAM GRID (AJUSTADA) */}
                <div className="bg-[#161b22] p-4 rounded-xl border border-slate-800 flex-1 overflow-hidden flex flex-col max-h-[280px]">
                    <div className="flex justify-between items-center mb-4"><h3 className="font-bold flex gap-2"><Gamepad2 className="text-sky-400"/> Steam</h3><div className="flex gap-2"><button onClick={refreshAllSteamPrices} disabled={refreshingSteam} className="bg-slate-700 px-2 rounded"><RefreshCw size={12} className={refreshingSteam ? "animate-spin" : ""}/></button><button onClick={() => setShowSteamForm(true)} className="text-[10px] bg-sky-500/10 text-sky-400 px-2 py-1 rounded">+ Caja</button></div></div>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 overflow-y-auto custom-scrollbar">
                        {steamItems.map(item => (
                            <div key={item.id} className="bg-[#0d1117] p-2 rounded border border-slate-800 flex flex-col justify-between h-20 relative group">
                                <button onClick={() => handleDeleteSteam(item.id)} className="absolute top-1 right-1 text-slate-600 opacity-0 group-hover:opacity-100"><Trash2 size={10}/></button>
                                <p className="text-[10px] text-white truncate">{item.item_name}</p>
                                <div className="mt-auto flex justify-between items-end border-t border-slate-800 pt-1"><span className="text-[9px] text-slate-500">{item.quantity} ud</span><span className={`text-xs font-bold text-sky-400 ${blurClass}`}>{formatEuro(item.quantity * item.current_price * 0.85)}</span></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="md:col-span-4 bg-[#161b22] rounded-xl border border-slate-800 p-4 flex flex-col h-[400px]">
                <h3 className="font-bold mb-4 flex gap-2"><Calendar className="text-slate-400"/> Historial</h3>
                <div className="overflow-y-auto flex-1 space-y-2 custom-scrollbar">
                    {currentMonthTransactions.map(t => (
                        <div key={t.id} className="flex justify-between items-center p-2 rounded bg-[#0d1117] border border-slate-800 group text-xs">
                            <div><p className="text-white font-medium">{t.name}</p><p className="text-[9px] text-slate-500">{t.category}</p></div>
                            <div className="flex gap-2"><span className={`${t.type==='income'?'text-emerald-400':'text-rose-500'} ${blurClass}`}>{formatEuro(t.type === 'income' ? t.amount : -t.amount)}</span><button onClick={() => handleDelete(t.id)} className="opacity-0 group-hover:opacity-100"><Trash2 size={12}/></button></div>
                        </div>
                    ))}
                </div>
            </div>

            {/* TARJETAS DINÁMICAS (MUESTRA TODO) */}
            <div className="md:col-span-12 grid grid-cols-2 md:grid-cols-5 gap-4">
                {categories.map((cat) => {
                    const totalUsed = currentMonthTransactions
                        .filter(t => t.category === cat.name && t.type === (cat.is_income ? 'income' : 'expense'))
                        .reduce((acc, t) => acc + t.amount, 0);
                        
                    const limit = cat.budget_limit || 0;
                    const remaining = Math.max(limit - totalUsed, 0);
                    const pct = limit > 0 ? Math.min((totalUsed / limit) * 100, 100) : 0;
                    
                    return (
                        <div key={cat.id} className="bg-[#161b22] p-4 rounded-xl border border-slate-800 flex flex-col items-center relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-full h-1" style={{backgroundColor: cat.color}}></div>
                            <h3 className="text-xs font-bold mb-1 uppercase tracking-wide truncate w-full text-center" style={{color: cat.color}}>{cat.name}</h3>
                            <div className="w-16 h-16 relative mb-2">
                                <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{v:totalUsed||1},{v:remaining}]} cx="50%" cy="50%" innerRadius={20} outerRadius={26} startAngle={90} endAngle={-270} dataKey="v" stroke="none"><Cell fill={cat.color}/><Cell fill="#30363d"/></Pie></PieChart></ResponsiveContainer>
                                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">{pct.toFixed(0)}%</div>
                            </div>
                            <div className="text-center w-full">
                                <p className={`text-lg font-bold ${blurClass}`}>{formatEuro(totalUsed)}</p>
                                <button onClick={() => setEditingLimit({id: cat.id, name: cat.name, amount: limit})} className="text-[9px] text-slate-500 hover:text-white flex items-center justify-center gap-1 w-full mt-1">
                                    {cat.is_income ? 'Meta: ' : 'Límite: '}<span className={blurClass}>{formatEuro(limit)}</span> <Settings size={10}/>
                                </button>
                            </div>
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
