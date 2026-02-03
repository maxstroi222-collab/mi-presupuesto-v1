'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { Plus, Save, X, Trash2, LogOut, User, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, 
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
  const [showForm, setShowForm] = useState(false);
  
  // --- MÁQUINA DEL TIEMPO ---
  const [currentDate, setCurrentDate] = useState(new Date());

  const currentMonthIndex = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const goToPrevMonth = () => setCurrentDate(new Date(currentYear, currentMonthIndex - 1, 1));
  const goToNextMonth = () => setCurrentDate(new Date(currentYear, currentMonthIndex + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const currentMonthName = capitalize(currentDate.toLocaleString('es-ES', { month: 'long' }));

  // --- TEMA Y COLORES (AÑADIDA NÓMINA) ---
  const THEME = {
    bg: '#0d1117', card: '#161b22', text: '#ffffff',
    nomina: '#0ea5e9',    // Azul Cielo (Nuevo)
    variable: '#f43f5e',  // Rosa
    facturas: '#fbbf24',  // Amarillo
    deuda: '#3b82f6',     // Azul
    inversiones: '#8b5cf6', // Morado
    ahorro: '#10b981',    // Verde
  };

  // AÑADIDA 'Nómina' AL PRINCIPIO DE LA LISTA
  const CATEGORIES = ['Nómina', 'Variable', 'Facturas', 'Deuda', 'Inversiones', 'Ahorro'];
  
  // OBJETIVOS (Para Nómina es "Cuánto espero ganar", para Gastos es "Límite")
  const BUDGETS: any = { 
    'Nómina': 2500,     // Meta de ingreso mensual
    'Variable': 1200, 
    'Facturas': 800, 
    'Deuda': 500, 
    'Inversiones': 300, 
    'Ahorro': 200 
  };
  
  const COLORS = [THEME.nomina, THEME.variable, THEME.facturas, THEME.deuda, THEME.inversiones, THEME.ahorro];

  const [newItem, setNewItem] = useState({ 
    name: '', amount: '', type: 'expense', category: 'Variable',
    date: new Date().toISOString().split('T')[0]
  });

  // 1. VERIFICAR SESIÓN
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if(session) fetchTransactions();
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if(session) fetchTransactions();
      else setAllTransactions([]);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. AUTH
  async function handleAuth() {
    setLoading(true);
    if (authMode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert(error.message);
    } else {
      if (!fullName) { alert("Introduce tu nombre"); setLoading(false); return; }
      const { error } = await supabase.auth.signUp({ 
        email, password, options: { data: { full_name: fullName } }
      });
      if (error) alert(error.message);
      else alert("Usuario creado. Inicia sesión.");
    }
    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  // 3. DATOS
  async function fetchTransactions() {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false });
    if (data) setAllTransactions(data);
  }

  async function handleAdd() {
    if (!newItem.name || !newItem.amount || !session) return;
    
    const { error } = await supabase.from('transactions').insert([{ 
      user_id: session.user.id,
      name: newItem.name, 
      amount: parseFloat(newItem.amount), 
      type: newItem.type, 
      category: newItem.category,
      date: new Date(newItem.date).toISOString() 
    }]);

    if (!error) {
      setNewItem({ ...newItem, name: '', amount: '' });
      setShowForm(false);
      fetchTransactions();
    } else {
      alert(error.message);
    }
  }

  async function handleClearDatabase() {
    if(!confirm("¿Borrar TUS datos?")) return;
    const { error } = await supabase.from('transactions').delete().neq('id', 0);
    if (!error) setAllTransactions([]);
  }

  // --- CÁLCULOS ---
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
  const currentBalance = startBalance + netIncome;

  // --- LÓGICA DE CATEGORÍAS ACTUALIZADA ---
  const categoryData = CATEGORIES.map(cat => {
    let value = 0;
    
    if (cat === 'Nómina') {
        // NÓMINA: Solo suma INGRESOS
        value = currentMonthTransactions
            .filter(t => t.type === 'income' && t.category === cat)
            .reduce((acc, t) => acc + t.amount, 0);
    } else if (cat === 'Inversiones' || cat === 'Ahorro') {
        // METAS: Suma TODO (Ingresos + Gastos)
        value = currentMonthTransactions
            .filter(t => t.category === cat)
            .reduce((acc, t) => acc + t.amount, 0);
    } else {
        // GASTOS PUROS (Variable, Facturas, Deuda): Suma solo GASTOS
        value = currentMonthTransactions
            .filter(t => t.type === 'expense' && t.category === cat)
            .reduce((acc, t) => acc + t.amount, 0);
    }

    return { name: cat, value };
  });

  const donutData = categoryData.filter(c => c.value > 0);
  const formatEuro = (amount: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);

  // --- VISTA LOGIN ---
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 font-sans" style={{ backgroundColor: THEME.bg }}>
        <div className="bg-[#161b22] p-8 rounded-2xl border border-slate-800 w-full max-w-sm shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Finanzas Personales</h1>
            <p className="text-slate-400 text-sm">Control total, usuario único.</p>
          </div>
          <div className="space-y-4">
            {authMode === 'register' && (
                <div>
                    <label className="text-xs text-slate-500 mb-1 block">Nombre</label>
                    <input type="text" className="w-full bg-[#0d1117] border border-slate-700 rounded p-3 text-white focus:border-emerald-500 outline-none"
                        placeholder="Ej: Juan Pérez" value={fullName} onChange={e => setFullName(e.target.value)} />
                </div>
            )}
            <div>
                <label className="text-xs text-slate-500 mb-1 block">Email</label>
                <input type="email" className="w-full bg-[#0d1117] border border-slate-700 rounded p-3 text-white focus:border-emerald-500 outline-none"
                    placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
                <label className="text-xs text-slate-500 mb-1 block">Contraseña</label>
                <input type="password" className="w-full bg-[#0d1117] border border-slate-700 rounded p-3 text-white focus:border-emerald-500 outline-none"
                    placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <button onClick={handleAuth} disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg transition-all mt-4">
                {loading ? 'Cargando...' : (authMode === 'login' ? 'Entrar' : 'Registrarse')}
            </button>
            <div className="text-center mt-4">
                <button onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setFullName(''); }} className="text-slate-400 text-sm hover:text-white underline">
                    {authMode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia Sesión'}
                </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const userName = session.user.user_metadata?.full_name || session.user.email.split('@')[0];

  // --- VISTA DASHBOARD ---
  return (
    <div className="min-h-screen p-4 md:p-6 font-sans text-white relative" style={{ backgroundColor: THEME.bg }}>
      
      {/* Botones Flotantes */}
      <button 
        onClick={() => {
            const today = new Date();
            let defaultDate = new Date(currentYear, currentMonthIndex, 1);
            if(today.getMonth() === currentMonthIndex && today.getFullYear() === currentYear) defaultDate = today;
            const offset = defaultDate.getTimezoneOffset();
            const adjustedDate = new Date(defaultDate.getTime() - (offset*60*1000));
            setNewItem({...newItem, date: adjustedDate.toISOString().split('T')[0]});
            setShowForm(true);
        }}
        className="fixed bottom-8 right-8 z-50 bg-emerald-500 hover:bg-emerald-400 text-black font-bold p-4 rounded-full shadow-2xl transition-all hover:scale-110"
      >
        <Plus size={24} />
      </button>

      <button onClick={handleLogout} className="fixed top-6 right-6 z-50 bg-[#161b22] hover:bg-rose-900/30 text-slate-400 hover:text-rose-400 p-2 rounded-lg border border-slate-800 transition-all flex gap-2 items-center text-sm">
        <LogOut size={16} /> Salir
      </button>
      <button onClick={handleClearDatabase} className="fixed bottom-8 left-8 z-50 bg-rose-900/50 hover:bg-rose-600 text-rose-200 hover:text-white p-3 rounded-full shadow-lg border border-rose-800">
        <Trash2 size={20} />
      </button>

      {/* Modal Formulario */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1e293b] p-6 rounded-2xl w-full max-w-md border border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-xl">Añadir Movimiento</h3>
              <button onClick={() => setShowForm(false)}><X className="text-slate-400 hover:text-white"/></button>
            </div>
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">Fecha</label>
                <input type="date" className="w-full bg-[#0f172a] border border-slate-600 rounded p-3 text-white"
                  value={newItem.date} onChange={e => setNewItem({...newItem, date: e.target.value})} />
              </div>
              <input className="w-full bg-[#0f172a] border border-slate-600 rounded p-3 text-white" placeholder="Concepto" 
                value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})}/>
              <input type="number" className="w-full bg-[#0f172a] border border-slate-600 rounded p-3 text-white" placeholder="Cantidad" 
                value={newItem.amount} onChange={e => setNewItem({...newItem, amount: e.target.value})}/>
              <div className="grid grid-cols-2 gap-2">
                <select className="bg-[#0f172a] border border-slate-600 rounded p-3 text-white" value={newItem.type} onChange={e => setNewItem({...newItem, type: e.target.value})}>
                  <option value="expense">Gasto (-)</option>
                  <option value="income">Ingreso (+)</option>
                </select>
                <select className="bg-[#0f172a] border border-slate-600 rounded p-3 text-white" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button onClick={handleAdd} className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-lg flex justify-center gap-2">
                <Save size={20}/> Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GRID PRINCIPAL */}
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-4">
        
        {/* COLUMNA IZQUIERDA */}
        <div className="md:col-span-3 space-y-4">
          <div className="bg-[#161b22] p-6 rounded-xl border border-slate-800 text-center relative group select-none">
             <button onClick={goToPrevMonth} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition"><ChevronLeft size={24} /></button>
             <button onClick={goToNextMonth} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition"><ChevronRight size={24} /></button>
             <h1 className="text-3xl font-light text-white cursor-pointer" onClick={goToToday}>{currentMonthName}</h1>
             <p className="text-slate-500 text-xs uppercase tracking-widest mt-1">- {currentYear} Dashboard -</p>
          </div>
          <div className="bg-[#161b22] p-4 rounded-xl border border-slate-800 flex justify-between items-center">
             <span className="text-slate-400 text-xs">Saldo Inicial (Ant.)</span>
             <span className="text-white font-mono">{formatEuro(startBalance)}</span>
          </div>
          <div className="bg-[#161b22] px-4 py-3 rounded-xl border border-slate-800 text-center">
             {new Date().getMonth() === currentMonthIndex && new Date().getFullYear() === currentYear ? (
                 <span className="text-emerald-400 text-xs font-bold flex items-center justify-center gap-2"><span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span> Mes En curso</span>
             ) : (
                 <span className="text-slate-400 text-xs font-bold flex items-center justify-center gap-2"><Calendar size={12}/> Visualizando Historial</span>
             )}
          </div>
          <div className="bg-[#161b22] p-6 rounded-xl border border-slate-800 text-center relative overflow-hidden">
             <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-500"></div>
             <p className="text-slate-400 text-xs mb-2">Saldo Final {currentMonthName}</p>
             <h2 className="text-2xl font-bold text-white">{formatEuro(currentBalance)}</h2>
          </div>
        </div>

        {/* CONTENIDO CENTRAL */}
        <div className="md:col-span-6 flex flex-col gap-4">
            <div className="bg-[#161b22] p-4 rounded-xl border border-slate-800 flex items-center gap-4">
                <div className="bg-slate-800 p-3 rounded-full"><User className="text-emerald-400" size={24} /></div>
                <div><p className="text-slate-400 text-xs uppercase tracking-wider">Panel de Control</p><h2 className="text-lg font-bold text-white">Bienvenido, {userName}</h2></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#161b22] px-4 py-5 rounded-xl border border-slate-800 flex flex-col justify-between h-32 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                    <div><h3 className="text-emerald-400 text-sm font-medium">Ingresos</h3><h2 className="text-2xl font-bold text-white mt-1">{formatEuro(income)}</h2></div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2"><div className="bg-emerald-500 h-full" style={{width: `${Math.min((income/2500)*100, 100)}%`}}></div></div>
                </div>
                <div className="bg-[#161b22] px-4 py-5 rounded-xl border border-slate-800 flex flex-col justify-between h-32 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
                    <div><h3 className="text-rose-500 text-sm font-medium">Gastos</h3><h2 className="text-2xl font-bold text-white mt-1">{formatEuro(totalExpenses)}</h2></div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2"><div className="bg-rose-500 h-full" style={{width: `${Math.min((totalExpenses/2000)*100, 100)}%`}}></div></div>
                </div>
            </div>
            <div className="bg-[#161b22] p-6 rounded-xl border border-slate-800 flex flex-col justify-center gap-6">
                <div>
                    <div className="flex justify-center gap-4 text-xs mb-2">
                    <span className="flex items-center gap-1"><div className="w-2 h-2 bg-emerald-500"></div> Ingresos</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 bg-rose-500"></div> Gastos</span>
                    </div>
                    <div className="w-full h-4 bg-slate-800 rounded-full flex overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{width: '55%'}}></div>
                        <div className="h-full bg-rose-500" style={{width: '45%'}}></div>
                    </div>
                </div>
                <div>
                    <div className="w-full h-8 bg-slate-800 rounded flex overflow-hidden">
                        {categoryData.map((cat, i) => (
                            <div key={i} style={{ width: `${(cat.value / (totalExpenses || 1)) * 100}%`, backgroundColor: COLORS[i] }} 
                                className="h-full flex items-center justify-center text-[10px] font-bold text-black/70 hover:opacity-80 transition-opacity"
                                title={cat.name}>
                                {cat.value > 0 && `${((cat.value/totalExpenses)*100).toFixed(0)}%`}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>

        {/* COLUMNA DERECHA */}
        <div className="md:col-span-3 flex flex-col gap-4">
            <div className="bg-[#161b22] p-6 rounded-xl border border-slate-800 text-center">
                <p className="text-slate-400 text-sm">Balance Neto</p>
                <h2 className={`text-2xl font-bold mt-2 ${netIncome >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                    {formatEuro(netIncome)}
                </h2>
            </div>
            <div className="bg-[#161b22] p-4 rounded-xl border border-slate-800 flex-1 flex flex-col items-center justify-center">
                <h3 className="text-slate-300 text-sm mb-4">Desglose {currentMonthName}</h3>
                <div className="w-full h-48 relative">
                        {totalExpenses > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={donutData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2} dataKey="value" stroke="none">
                                        {donutData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[CATEGORIES.indexOf(entry.name)]} />)}
                                    </Pie>
                                    <RechartsTooltip formatter={(value: number) => formatEuro(value)} contentStyle={{backgroundColor: '#0d1117', border:'none'}} itemStyle={{color:'#fff'}} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : <p className="text-xs text-slate-600 flex h-full items-center justify-center">Sin gastos</p>}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4">
                   {CATEGORIES.map((cat, i) => (
                       <div key={i} className="flex items-center gap-2 text-[10px] text-slate-400">
                           <div className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[i]}}></div>
                           {cat}
                       </div>
                   ))}
               </div>
            </div>
        </div>

        {/* FILA INFERIOR (AHORA CON 6 COLUMNAS SI HAY ESPACIO O GRID ADAPTATIVO) */}
        <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-2">
            {CATEGORIES.map((cat, index) => {
                const total = categoryData.find(c => c.name === cat)?.value || 0;
                // Si es Nómina (Ingreso), mostramos "Conseguido" vs "Meta". Si es Gasto, "Usado" vs "Restante"
                const pieData = [{ name: 'Actual', value: total || 1 }, { name: 'Restante', value: (BUDGETS[cat] - total) > 0 ? (BUDGETS[cat] - total) : 0 }];
                const pct = Math.min((total / BUDGETS[cat]) * 100, 100);
                const color = COLORS[index];
                return (
                    <div key={cat} className="bg-[#161b22] p-4 rounded-xl border border-slate-800 flex flex-col items-center relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-full h-1" style={{backgroundColor: color}}></div>
                        <h3 className="text-sm font-bold mb-1" style={{color: color}}>{cat}</h3>
                        <h2 className="text-xl font-bold text-white mb-4">{formatEuro(total)}</h2>
                        <div className="w-24 h-24 relative mb-4">
                             <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={38} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                                        <Cell fill={color} /> <Cell fill="#30363d" />
                                    </Pie>
                                </PieChart>
                             </ResponsiveContainer>
                             <div className="absolute inset-0 flex flex-col items-center justify-center">
                                 <span className="text-[10px] text-slate-400">
                                     {cat === 'Nómina' ? '% Conseguido' : '% Usado'}
                                 </span>
                                 <span className="text-xs font-bold text-white">{((total/(cat === 'Nómina' ? BUDGETS[cat] : (income || 1)))*100).toFixed(0)}%</span>
                             </div>
                        </div>
                        <div className="w-full space-y-2 mt-auto">
                            <div className="flex justify-between text-[10px] text-slate-400"><span>Progreso</span><span>{pct.toFixed(0)}%</span></div>
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, backgroundColor: color }}></div></div>
                        </div>
                    </div>
                )
            })}
        </div>
      </div>
    </div>
  );
}
