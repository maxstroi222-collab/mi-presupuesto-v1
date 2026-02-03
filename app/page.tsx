'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { Plus, Save, X, Trash2, LogOut, User, ChevronLeft, ChevronRight, Calendar, Gamepad2, Search, Loader2, RefreshCw, Box, Shield, Megaphone, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

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
  const [showForm, setShowForm] = useState(false);
  const [showSteamForm, setShowSteamForm] = useState(false);
  
  // ESTADOS ADMIN
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [systemAlert, setSystemAlert] = useState({ message: '', active: false });
  const [adminMessageInput, setAdminMessageInput] = useState('');

  // Estados Steam
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [refreshingSteam, setRefreshingSteam] = useState(false);

  // --- MÁQUINA DEL TIEMPO ---
  const [currentDate, setCurrentDate] = useState(new Date());
  const currentMonthIndex = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const goToPrevMonth = () => setCurrentDate(new Date(currentYear, currentMonthIndex - 1, 1));
  const goToNextMonth = () => setCurrentDate(new Date(currentYear, currentMonthIndex + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const currentMonthName = capitalize(currentDate.toLocaleString('es-ES', { month: 'long' }));

  // --- TEMA Y COLORES ---
  const THEME = {
    bg: '#0d1117', card: '#161b22', text: '#ffffff',
    nomina: '#0ea5e9', variable: '#f43f5e', facturas: '#fbbf24', 
    deuda: '#3b82f6', inversiones: '#8b5cf6', ahorro: '#10b981',
    steam: '#66c0f4' 
  };

  const CATEGORIES = ['Nómina', 'Variable', 'Facturas', 'Deuda', 'Inversiones', 'Ahorro'];
  const DISPLAY_CATEGORIES = ['Variable', 'Facturas', 'Deuda', 'Inversiones', 'Ahorro'];
  
  const BUDGETS: any = { 
    'Nómina': 2500, 'Variable': 1200, 'Facturas': 800, 
    'Deuda': 500, 'Inversiones': 300, 'Ahorro': 200 
  };
  
  const COLORS = [THEME.nomina, THEME.variable, THEME.facturas, THEME.deuda, THEME.inversiones, THEME.ahorro];

  const [newItem, setNewItem] = useState({ name: '', amount: '', type: 'expense', category: 'Variable', date: new Date().toISOString().split('T')[0] });
  const [newSteamItem, setNewSteamItem] = useState({ name: '', quantity: '', price: '' });

  // 1. CARGA INICIAL
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if(session) loadAllData();
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if(session) loadAllData();
      else { setAllTransactions([]); setSteamItems([]); }
    });
    
    // Cargar alerta del sistema (independiente de la sesión)
    fetchSystemAlert();

    return () => subscription.unsubscribe();
  }, []);

  async function loadAllData() {
    fetchTransactions();
    fetchSteamPortfolio();
  }

  // --- LÓGICA STEAM API ---
  const parseSteamPrice = (priceStr: string) => {
    let clean = priceStr.replace('€', '').replace('$', '').replace(',', '.').trim();
    clean = clean.replace('--', '00').replace('-', '00');
    return parseFloat(clean);
  };

  async function getSteamPrice() {
    if(!newSteamItem.name) return;
    setFetchingPrice(true);
    try {
        const response = await fetch(`/api/steam?name=${encodeURIComponent(newSteamItem.name)}`);
        const data = await response.json();
        
        if (data.lowest_price || data.median_price) {
            const rawPrice = data.lowest_price || data.median_price;
            const cleanPrice = parseSteamPrice(rawPrice);
            setNewSteamItem(prev => ({ ...prev, price: cleanPrice.toString() }));
        } else {
            alert("No encontrado. Prueba con el nombre exacto en inglés.");
        }
    } catch (error) {
        alert("Error al conectar con Steam.");
    }
    setFetchingPrice(false);
  }

  async function refreshAllSteamPrices() {
    if (steamItems.length === 0) return;
    setRefreshingSteam(true);
    const updates = steamItems.map(async (item) => {
        try {
            const response = await fetch(`/api/steam?name=${encodeURIComponent(item.item_name)}`);
            const data = await response.json();
            const rawPrice = data.lowest_price || data.median_price;
            if (rawPrice) {
                const newPrice = parseSteamPrice(rawPrice);
                if (newPrice !== item.current_price) {
                    await supabase.from('steam_portfolio').update({ current_price: newPrice }).eq('id', item.id);
                }
            }
        } catch (error) { console.error(`Error actualizando ${item.item_name}`); }
    });
    await Promise.all(updates);
    await fetchSteamPortfolio();
    setRefreshingSteam(false);
  }

  // --- FUNCIONES DB TRANSACCIONES ---
  async function fetchTransactions() {
    const { data } = await supabase.from('transactions').select('*').order('date', { ascending: false });
    if (data) setAllTransactions(data);
  }

  async function handleAdd() {
    if (!newItem.name || !newItem.amount || !session) return;
    const { error } = await supabase.from('transactions').insert([{ 
      user_id: session.user.id, name: newItem.name, amount: parseFloat(newItem.amount), 
      type: newItem.type, category: newItem.category, date: new Date(newItem.date).toISOString() 
    }]);
    if (!error) { setNewItem({ ...newItem, name: '', amount: '' }); setShowForm(false); fetchTransactions(); }
  }

  async function handleDelete(id: number) {
    if(!confirm("¿Borrar este movimiento?")) return;
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (!error) fetchTransactions();
  }

  // --- FUNCIONES DB STEAM ---
  async function fetchSteamPortfolio() {
    const { data } = await supabase.from('steam_portfolio').select('*');
    if (data) setSteamItems(data);
  }

  async function handleAddSteam() {
    if (!newSteamItem.name || !newSteamItem.quantity || !newSteamItem.price || !session) return;
    const { error } = await supabase.from('steam_portfolio').insert([{ 
      user_id: session.user.id, item_name: newSteamItem.name, 
      quantity: parseInt(newSteamItem.quantity), current_price: parseFloat(newSteamItem.price)
    }]);
    if (!error) { setNewSteamItem({ name: '', quantity: '', price: '' }); setShowSteamForm(false); fetchSteamPortfolio(); }
  }

  async function handleDeleteSteam(id: number) {
    if(!confirm("¿Borrar caja?")) return;
    const { error } = await supabase.from('steam_portfolio').delete().eq('id', id);
    if (!error) fetchSteamPortfolio();
  }

  // --- FUNCIONES ADMIN (ALERTAS) ---
  async function fetchSystemAlert() {
    const { data } = await supabase.from('system_config').select('*').eq('key_name', 'global_alert').single();
    if (data) {
        setSystemAlert({ message: data.value, active: data.is_active });
        setAdminMessageInput(data.value); // Rellenar input del admin
    }
  }

  async function handleSaveAlert(active: boolean) {
    if (!adminMessageInput) return;
    const { error } = await supabase
        .from('system_config')
        .update({ value: adminMessageInput, is_active: active })
        .eq('key_name', 'global_alert');
    
    if (error) alert("Error al guardar aviso: " + error.message);
    else {
        fetchSystemAlert();
        alert(active ? "Aviso publicado" : "Aviso ocultado");
    }
  }


  async function handleLogout() { await supabase.auth.signOut(); }
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
  
  const pastTransactions = allTransactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() < currentYear || (d.getFullYear() === currentYear && d.getMonth() < currentMonthIndex);
  });

  const income = currentMonthTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalExpenses = currentMonthTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const netIncome = income - totalExpenses;

  const startBalance = pastTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0) -
                       pastTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);

  // --- CÁLCULO STEAM ---
  const steamTotalValue = steamItems.reduce((acc, item) => acc + (item.quantity * item.current_price), 0);
  const steamNetValue = steamTotalValue * 0.85; 

  const currentBalance = startBalance + netIncome; 
  const netWorth = currentBalance + steamNetValue; 

  const categoryData = DISPLAY_CATEGORIES.map(cat => {
    let value = 0;
    if (cat === 'Inversiones' || cat === 'Ahorro') {
        value = currentMonthTransactions.filter(t => t.category === cat).reduce((acc, t) => acc + t.amount, 0);
    } else {
        value = currentMonthTransactions.filter(t => t.type === 'expense' && t.category === cat).reduce((acc, t) => acc + t.amount, 0);
    }
    return { name: cat, value };
  });
  const donutData = categoryData.filter(c => c.value > 0);

  const formatEuro = (amount: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
  const userName = session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0];
  const isAdmin = session?.user?.app_metadata?.role === 'admin';
  
  // --- VISTA LOGIN ---
  if (!session) return (
    <div className="min-h-screen flex items-center justify-center p-4 font-sans" style={{ backgroundColor: THEME.bg }}>
        <div className="bg-[#161b22] p-8 rounded-2xl border border-slate-800 w-full max-w-sm shadow-2xl">
          <h1 className="text-3xl font-bold text-white mb-2 text-center">Finanzas Personales</h1>
          <div className="space-y-4">
            {authMode === 'register' && <input type="text" className="w-full bg-[#0d1117] border border-slate-700 rounded p-3 text-white" placeholder="Nombre" value={fullName} onChange={e => setFullName(e.target.value)} />}
            <input type="email" className="w-full bg-[#0d1117] border border-slate-700 rounded p-3 text-white" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
            <input type="password" className="w-full bg-[#0d1117] border border-slate-700 rounded p-3 text-white" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} />
            <button onClick={handleAuth} disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg">{authMode === 'login' ? 'Entrar' : 'Registrarse'}</button>
            <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="w-full text-slate-400 text-sm hover:text-white underline">{authMode === 'login' ? '¿Crear cuenta?' : '¿Iniciar Sesión?'}</button>
          </div>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen font-sans text-white relative flex flex-col" style={{ backgroundColor: THEME.bg }}>
      
      {/* --- BANNER DE AVISO GLOBAL (ANCLADO ARRIBA) --- */}
      {systemAlert.active && (
        <div className="w-full bg-amber-500/10 border-b border-amber-500/20 py-2 px-4 text-center">
            <p className="text-amber-400 text-sm font-bold flex items-center justify-center gap-2">
                <Megaphone size={16} /> {systemAlert.message}
            </p>
        </div>
      )}

      <div className="flex-1 p-4 md:p-6 relative">
          {/* Botón Flotante + */}
          <button onClick={() => {
                const today = new Date();
                let d = new Date(currentYear, currentMonthIndex, 1);
                if(today.getMonth() === currentMonthIndex && today.getFullYear() === currentYear) d = today;
                const offset = d.getTimezoneOffset();
                const adj = new Date(d.getTime() - (offset*60*1000));
                setNewItem({...newItem, date: adj.toISOString().split('T')[0]});
                setShowForm(true);
            }}
            className="fixed bottom-8 right-8 z-50 bg-emerald-500 hover:bg-emerald-400 text-black font-bold p-4 rounded-full shadow-2xl hover:scale-110 transition-all"><Plus size={24} />
          </button>

          {/* ZONA INFERIOR IZQUIERDA: SALIR + ADMIN */}
          <div className="fixed bottom-8 left-8 z-50 flex gap-3 items-center">
              {/* Botón Salir */}
              <button onClick={handleLogout} className="bg-[#1e293b] hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-full shadow-xl border border-slate-600 flex items-center gap-2 transition-all">
                <LogOut size={18} /> Salir
              </button>

              {/* Botón Admin (SOLO ADMINS) */}
              {isAdmin && (
                  <button onClick={() => setShowAdminPanel(true)} className="bg-red-900/80 hover:bg-red-700 text-white p-3 rounded-full shadow-xl border border-red-500/50 transition-all" title="Panel de Administrador">
                    <Shield size={20} />
                  </button>
              )}
          </div>

          {/* MODAL PANEL DE ADMINISTRADOR */}
          {showAdminPanel && (
            <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4">
               <div className="bg-[#1e293b] p-6 rounded-2xl w-full max-w-lg border border-red-500/30 shadow-2xl relative">
                  <div className="flex justify-between mb-6 border-b border-slate-700 pb-4">
                      <h3 className="font-bold text-xl text-red-400 flex items-center gap-2"><Shield size={24}/> Panel de Control</h3>
                      <button onClick={() => setShowAdminPanel(false)}><X className="hover:text-white text-slate-400"/></button>
                  </div>
                  
                  {/* Sección de Avisos */}
                  <div className="space-y-4">
                      <h4 className="text-white font-bold flex items-center gap-2"><Megaphone size={18} className="text-amber-400"/> Aviso Global</h4>
                      <p className="text-xs text-slate-400">Este mensaje aparecerá anclado en la parte superior de la web para TODOS los usuarios.</p>
                      
                      <textarea 
                         className="w-full bg-[#0f172a] border border-slate-600 rounded p-3 text-white h-24 resize-none"
                         placeholder="Ej: Mantenimiento programado para esta noche..."
                         value={adminMessageInput}
                         onChange={(e) => setAdminMessageInput(e.target.value)}
                      />
                      
                      <div className="flex gap-2">
                          <button onClick={() => handleSaveAlert(true)} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded font-bold text-sm">
                             Publicar Aviso
                          </button>
                          <button onClick={() => handleSaveAlert(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded font-bold text-sm">
                             Ocultar Aviso
                          </button>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-slate-700">
                          <p className="text-xs text-slate-500 flex items-center gap-1"><AlertTriangle size={12}/> Más herramientas próximamente...</p>
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
                    <select className="bg-[#0f172a] border border-slate-600 rounded p-3 text-white" value={newItem.type} onChange={e => setNewItem({...newItem, type: e.target.value})}><option value="expense">Gasto</option><option value="income">Ingreso</option></select>
                    <select className="bg-[#0f172a] border border-slate-600 rounded p-3 text-white" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
                  </div>
                  <button onClick={handleAdd} className="w-full bg-emerald-500 text-black font-bold py-3 rounded-lg"><Save className="inline mr-2" size={18}/> Guardar</button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL STEAM */}
          {showSteamForm && (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
              <div className="bg-[#1e293b] p-6 rounded-2xl w-full max-w-md border border-slate-700">
                <div className="flex justify-between mb-4"><h3 className="font-bold text-sky-400">Añadir Caja CS</h3><button onClick={() => setShowSteamForm(false)}><X/></button></div>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input className="w-full bg-[#0f172a] border border-slate-600 rounded p-3 text-white" placeholder="Market Hash Name (ej: Recoil Case)" value={newSteamItem.name} onChange={e => setNewSteamItem({...newSteamItem, name: e.target.value})} onBlur={getSteamPrice} />
                    <button onClick={getSteamPrice} disabled={fetchingPrice} className="bg-sky-500/20 text-sky-400 p-3 rounded border border-sky-500/50">
                        {fetchingPrice ? <Loader2 className="animate-spin" size={20}/> : <Search size={20}/>}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" className="w-full bg-[#0f172a] border border-slate-600 rounded p-3 text-white" placeholder="Cantidad" value={newSteamItem.quantity} onChange={e => setNewSteamItem({...newSteamItem, quantity: e.target.value})}/>
                    <input type="number" className="w-full bg-[#0f172a] border border-slate-600 rounded p-3 text-white" placeholder="Precio Unidad (€)" value={newSteamItem.price} onChange={e => setNewSteamItem({...newSteamItem, price: e.target.value})}/>
                  </div>
                  <p className="text-xs text-slate-400">* Precio extraído de Steam Community Market.</p>
                  <button onClick={handleAddSteam} className="w-full bg-sky-500 text-black font-bold py-3 rounded-lg"><Gamepad2 className="inline mr-2" size={18}/> Guardar en Cartera</button>
                </div>
              </div>
            </div>
          )}

          {/* LAYOUT PRINCIPAL */}
          <div className="max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-6 pb-20">
            
            {/* HEADER BIENVENIDA */}
            <div className="md:col-span-12 bg-[#161b22] p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="bg-slate-800 p-3 rounded-full">
                      <User className={isAdmin ? "text-red-500" : "text-emerald-400"} size={24} />
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs uppercase tracking-wider">Bienvenido</p>
                      <h2 className={`text-lg font-bold ${isAdmin ? 'text-red-500' : 'text-white'}`}>
                        {userName} {isAdmin && <span className="text-xs ml-1 opacity-70">(Admin)</span>}
                      </h2>
                    </div>
                </div>
                <div className="text-right hidden md:block">
                    <p className="text-slate-400 text-xs">Patrimonio Total (Net Worth)</p>
                    <h2 className={`text-2xl font-bold ${isAdmin ? 'text-red-500' : 'text-emerald-400'}`}>{formatEuro(netWorth)}</h2>
                </div>
            </div>

            {/* COLUMNA 1 */}
            <div className="md:col-span-3 space-y-4">
              <div className="bg-[#161b22] p-6 rounded-xl border border-slate-800 text-center relative group select-none">
                <button onClick={goToPrevMonth} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition"><ChevronLeft size={24} /></button>
                <button onClick={goToNextMonth} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition"><ChevronRight size={24} /></button>
                <h1 className="text-3xl font-light text-white cursor-pointer" onClick={goToToday}>{currentMonthName}</h1>
                <p className="text-slate-500 text-xs uppercase tracking-widest mt-1">- {currentYear} -</p>
              </div>
              
              <div className="bg-[#161b22] p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400 text-xs">Saldo Líquido</span>
                <span className="text-white font-mono font-bold">{formatEuro(currentBalance)}</span>
              </div>

              <div className="bg-gradient-to-br from-[#161b22] to-slate-900 p-4 rounded-xl border border-slate-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-10"><Gamepad2 size={64}/></div>
                <p className="text-sky-400 text-xs font-bold mb-1">Valor Cajas Steam (Neto)</p>
                <h2 className="text-2xl font-bold text-white mb-1">{formatEuro(steamNetValue)}</h2>
                <p className="text-[10px] text-slate-500">Ya descontado el 15% de comisión</p>
              </div>
            </div>

            {/* COLUMNA 2 */}
            <div className="md:col-span-5 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#161b22] px-4 py-5 rounded-xl border border-slate-800 flex flex-col justify-between h-28 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                        <div><h3 className="text-emerald-400 text-xs font-medium uppercase">Ingresos Mes</h3><h2 className="text-2xl font-bold text-white mt-1">{formatEuro(income)}</h2></div>
                    </div>
                    <div className="bg-[#161b22] px-4 py-5 rounded-xl border border-slate-800 flex flex-col justify-between h-28 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
                        <div><h3 className="text-rose-500 text-xs font-medium uppercase">Gastos Mes</h3><h2 className="text-2xl font-bold text-white mt-1">{formatEuro(totalExpenses)}</h2></div>
                    </div>
                </div>

                {/* SECCIÓN STEAM REDISEÑADA (INVENTARIO HORIZONTAL) */}
                <div className="bg-[#161b22] p-4 rounded-xl border border-slate-800 flex-1 flex flex-col h-full max-h-[350px]">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-white flex items-center gap-2"><Gamepad2 className="text-sky-400" size={20}/> Cartera Steam</h3>
                        <div className="flex gap-2">
                            <button onClick={refreshAllSteamPrices} disabled={refreshingSteam} className="text-xs bg-slate-700 text-white px-2 py-1 rounded hover:bg-slate-600 flex items-center gap-1">
                                <RefreshCw size={12} className={refreshingSteam ? "animate-spin" : ""} />
                            </button>
                            <button onClick={() => setShowSteamForm(true)} className="text-xs bg-sky-500/10 text-sky-400 px-2 py-1 rounded hover:bg-sky-500/20">+ Añadir</button>
                        </div>
                    </div>
                    
                    {steamItems.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">Inventario vacío</div>
                    ) : (
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 overflow-y-auto pr-1 custom-scrollbar">
                            {steamItems.map(item => (
                                <div key={item.id} className="bg-[#0d1117] p-2 rounded border border-slate-800 hover:border-sky-500/30 transition relative group flex flex-col justify-between h-24">
                                    <button onClick={() => handleDeleteSteam(item.id)} className="absolute top-1 right-1 text-slate-600 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition"><Trash2 size={12}/></button>
                                    
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-6 h-6 rounded-full bg-sky-900/50 flex items-center justify-center text-sky-400"><Box size={12}/></div>
                                        <p className="text-xs text-white font-medium truncate w-full" title={item.item_name}>{item.item_name}</p>
                                    </div>
                                    
                                    <div className="mt-auto">
                                        <div className="flex justify-between text-[10px] text-slate-400">
                                            <span>{item.quantity} ud.</span>
                                            <span>{formatEuro(item.current_price)}/u</span>
                                        </div>
                                        <div className="border-t border-slate-800 mt-1 pt-1 flex justify-between items-end">
                                            <span className="text-[9px] text-slate-500">Neto</span>
                                            <span className="text-sm font-bold text-sky-400">{formatEuro(item.quantity * item.current_price * 0.85)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* COLUMNA 3 */}
            <div className="md:col-span-4 bg-[#161b22] rounded-xl border border-slate-800 p-4 flex flex-col h-full max-h-[500px]">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Calendar className="text-slate-400" size={18}/> Historial {currentMonthName}</h3>
                {currentMonthTransactions.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">No hay movimientos este mes.</div>
                ) : (
                    <div className="overflow-y-auto flex-1 pr-2 space-y-2 custom-scrollbar">
                        {currentMonthTransactions.map(t => (
                            <div key={t.id} className="flex justify-between items-center p-3 rounded-lg bg-[#0d1117] border border-slate-800/50 group hover:border-slate-700 transition">
                                <div>
                                    <p className="text-white font-medium text-sm">{t.name}</p>
                                    <p className="text-[10px] text-slate-500">{new Date(t.date).toLocaleDateString()} • {t.category}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`font-bold text-sm ${t.type==='income'?'text-emerald-400':'text-rose-500'}`}>
                                        {t.type==='income'?'+':'-'}{formatEuro(t.amount)}
                                    </span>
                                    <button onClick={() => handleDelete(t.id)} className="text-slate-600 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition"><Trash2 size={16}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* FILA INFERIOR */}
            <div className="md:col-span-12 grid grid-cols-2 md:grid-cols-5 gap-4">
                {DISPLAY_CATEGORIES.map((cat, index) => {
                    const totalUsed = categoryData.find(c => c.name === cat)?.value || 0;
                    const limit = BUDGETS[cat] || 1000;
                    const remaining = limit - totalUsed;
                    const pct = Math.min((totalUsed / limit) * 100, 100);
                    const color = COLORS[index + 1]; 

                    const pieData = [{ name: 'Gastado', value: totalUsed || 1 }, { name: 'Restante', value: remaining > 0 ? remaining : 0 }];
                    
                    return (
                        <div key={cat} className="bg-[#161b22] p-4 rounded-xl border border-slate-800 flex flex-col items-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1" style={{backgroundColor: color}}></div>
                            <h3 className="text-xs font-bold mb-1 uppercase tracking-wide" style={{color: color}}>{cat}</h3>
                            
                            <div className="w-20 h-20 relative mb-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={25} outerRadius={32} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                                            <Cell fill={color} /> <Cell fill="#30363d" />
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-[10px] font-bold text-white">{pct.toFixed(0)}%</span>
                                </div>
                            </div>

                            <div className="text-center w-full">
                                <p className="text-lg font-bold text-white">{formatEuro(totalUsed)}</p>
                                <p className="text-[10px] text-slate-500 border-t border-slate-700 pt-1 mt-1">Límite: <span className="text-slate-300">{formatEuro(limit)}</span></p>
                            </div>
                        </div>
                    )
                })}
            </div>
          </div>
          <style jsx global>{`
            .custom-scrollbar::-webkit-scrollbar { width: 4px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: #0d1117; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #30363d; border-radius: 4px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #58a6ff; }
          `}</style>
      </div>
    </div>
  );
}
