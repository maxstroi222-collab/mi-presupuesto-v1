'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { Plus, Save, X, History, ArrowLeft, Calendar } from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, 
} from 'recharts';

export default function Dashboard() {
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState<'current' | 'history'>('current'); // Controla si vemos el mes o el historial
  
  // --- CONFIGURACIÓN DE FECHAS ---
  const now = new Date();
  const currentMonthIndex = now.getMonth();
  const currentYear = now.getFullYear();
  
  // Formateador de moneda Euro
  const formatEuro = (amount: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  // Capitalizar primera letra (ej: febrero -> Febrero)
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const currentMonthName = capitalize(now.toLocaleString('es-ES', { month: 'long' }));

  // --- TEMAS Y CATEGORÍAS ---
  const THEME = {
    bg: '#0d1117',        
    card: '#161b22',      
    text: '#ffffff',
    textDim: '#8b949e',
    variable: '#f43f5e',   // Rosa
    facturas: '#fbbf24',   // Amarillo
    deuda: '#3b82f6',      // Azul
    inversiones: '#8b5cf6',// Morado
    ahorro: '#10b981',     // Verde
  };

  // Nombres traducidos
  const CATEGORIES = ['Variable', 'Facturas', 'Deuda', 'Inversiones', 'Ahorro'];
  
  // Presupuestos ficticios (en el futuro los haremos editables)
  const BUDGETS: any = { 
    'Variable': 1200, 
    'Facturas': 800, 
    'Deuda': 500, 
    'Inversiones': 300, 
    'Ahorro': 200 
  };

  const [newItem, setNewItem] = useState({ 
    name: '', amount: '', type: 'expense', category: 'Variable' 
  });

  useEffect(() => {
    fetchTransactions();
  }, []);

  async function fetchTransactions() {
    // Traemos TODO para poder calcular el histórico
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false }); // Asegúrate de usar 'date' o 'created_at'
    if (data) setAllTransactions(data);
  }

  async function handleAdd() {
    if (!newItem.name || !newItem.amount) return;
    
    // Insertamos usando la fecha actual automáticamente
    const { error } = await supabase.from('transactions').insert([{ 
      name: newItem.name, 
      amount: parseFloat(newItem.amount), 
      type: newItem.type, 
      category: newItem.category,
      date: new Date().toISOString() // Guardamos la fecha exacta
    }]);

    if (!error) {
      setNewItem({ name: '', amount: '', type: 'expense', category: 'Variable' });
      setShowForm(false);
      fetchTransactions();
    } else {
      alert("Error al guardar: " + error.message);
    }
  }

  // --- LÓGICA DE FILTRADO (MAGIA DE FECHAS) ---
  
  // 1. Separar transacciones de ESTE MES vs PASADAS
  const currentMonthTransactions = allTransactions.filter(t => {
    const d = new Date(t.date || t.created_at);
    return d.getMonth() === currentMonthIndex && d.getFullYear() === currentYear;
  });

  const pastTransactions = allTransactions.filter(t => {
    const d = new Date(t.date || t.created_at);
    // Es pasado si el año es menor, o si es el mismo año pero mes menor
    return d.getFullYear() < currentYear || (d.getFullYear() === currentYear && d.getMonth() < currentMonthIndex);
  });

  // 2. Calcular datos de ESTE MES
  const income = currentMonthTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalExpenses = currentMonthTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const netIncome = income - totalExpenses;

  // 3. Calcular SALDO INICIAL (Ahorro acumulado de meses anteriores)
  const pastIncome = pastTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const pastExpenses = pastTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const startBalance = pastIncome - pastExpenses; // Lo que te sobró de la historia

  const currentBalance = startBalance + netIncome; // Lo que tienes hoy en total

  // Datos para gráficos
  const categoryData = CATEGORIES.map(cat => {
    const value = currentMonthTransactions
      .filter(t => t.type === 'expense' && t.category === cat)
      .reduce((acc, t) => acc + t.amount, 0);
    return { name: cat, value };
  });

  const donutData = categoryData.filter(c => c.value > 0);
  const COLORS = [THEME.variable, THEME.facturas, THEME.deuda, THEME.inversiones, THEME.ahorro];

  return (
    <div className="min-h-screen p-4 md:p-6 font-sans text-white" style={{ backgroundColor: THEME.bg }}>
      
      {/* Botón flotante (+) */}
      {viewMode === 'current' && (
        <button 
          onClick={() => setShowForm(true)}
          className="fixed bottom-8 right-8 z-50 bg-emerald-500 hover:bg-emerald-400 text-black font-bold p-4 rounded-full shadow-2xl transition-all transform hover:scale-110"
        >
          <Plus size={24} />
        </button>
      )}

      {/* MODAL FORMULARIO */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1e293b] p-6 rounded-2xl w-full max-w-md border border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-xl">Añadir Movimiento</h3>
              <button onClick={() => setShowForm(false)}><X className="text-slate-400 hover:text-white"/></button>
            </div>
            <div className="space-y-4">
              <input 
                className="w-full bg-[#0f172a] border border-slate-600 rounded p-3 text-white" 
                placeholder="Concepto" 
                value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})}
              />
              <input 
                type="number" className="w-full bg-[#0f172a] border border-slate-600 rounded p-3 text-white" 
                placeholder="Cantidad (0.00)" 
                value={newItem.amount} onChange={e => setNewItem({...newItem, amount: e.target.value})}
              />
              <div className="grid grid-cols-2 gap-2">
                <select 
                  className="bg-[#0f172a] border border-slate-600 rounded p-3 text-white"
                  value={newItem.type} onChange={e => setNewItem({...newItem, type: e.target.value})}
                >
                  <option value="expense">Gasto (-)</option>
                  <option value="income">Ingreso (+)</option>
                </select>
                <select 
                  className="bg-[#0f172a] border border-slate-600 rounded p-3 text-white"
                  value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})}
                >
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

      {/* --- GRID PRINCIPAL --- */}
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-4">
        
        {/* COLUMNA IZQUIERDA (Estática) */}
        <div className="md:col-span-3 space-y-4">
          
          {/* HEADER DEL MES */}
          <div className="bg-[#161b22] p-6 rounded-xl border border-slate-800 text-center">
             <h1 className="text-3xl font-light text-white">{viewMode === 'current' ? currentMonthName : 'Historial'}</h1>
             <p className="text-slate-500 text-xs uppercase tracking-widest mt-1">- {currentYear} Dashboard -</p>
          </div>
          
          {/* SALDO INICIAL (Lo que traes de meses anteriores) */}
          <div className="bg-[#161b22] p-4 rounded-xl border border-slate-800 flex justify-between items-center">
             <span className="text-slate-400 text-xs">Saldo Inicial (Ant.)</span>
             <span className="text-white font-mono">{formatEuro(startBalance)}</span>
          </div>
          
          {/* --- AQUÍ ESTÁ EL CAMBIO SOLICITADO (Botón Historial) --- */}
          <div 
             onClick={() => setViewMode(viewMode === 'current' ? 'history' : 'current')}
             className="bg-[#161b22] p-6 rounded-xl border border-slate-800 text-center cursor-pointer hover:bg-[#1e2530] transition group relative overflow-hidden"
          >
             <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
             {viewMode === 'current' ? (
                <>
                    <History className="mx-auto mb-2 text-blue-500" size={24}/>
                    <p className="text-slate-400 text-xs mb-1">Ver Meses Anteriores</p>
                    <h3 className="text-lg font-bold text-white group-hover:text-blue-400">Ir al Historial</h3>
                </>
             ) : (
                <>
                    <ArrowLeft className="mx-auto mb-2 text-emerald-500" size={24}/>
                    <p className="text-slate-400 text-xs mb-1">Volver al Mes Actual</p>
                    <h3 className="text-lg font-bold text-white group-hover:text-emerald-400">Ver {currentMonthName}</h3>
                </>
             )}
          </div>

          {/* SALDO ACTUAL TOTAL */}
          <div className="bg-[#161b22] p-6 rounded-xl border border-slate-800 text-center relative overflow-hidden">
             <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-500"></div>
             <p className="text-slate-400 text-xs mb-2">Saldo Total Real</p>
             <h2 className="text-2xl font-bold text-white">{formatEuro(currentBalance)}</h2>
          </div>
        </div>

        {/* --- CONTENIDO CENTRAL (CAMBIA SEGÚN PESTAÑA) --- */}
        
        {viewMode === 'current' ? (
        <>
            {/* VISTA DASHBOARD (MES ACTUAL) */}
            <div className="md:col-span-6 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4 h-full">
                {/* Ingresos */}
                <div className="bg-[#161b22] p-6 rounded-xl border border-slate-800 text-center">
                    <h3 className="text-emerald-400 font-medium mb-1">Ingresos Totales</h3>
                    <h2 className="text-3xl font-bold text-white mb-4">{formatEuro(income)}</h2>
                    <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-slate-500"><span>Objetivo</span><span>{formatEuro(2500)}</span></div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-white h-full" style={{width: `${Math.min((income/2500)*100, 100)}%`}}></div>
                    </div>
                    </div>
                </div>

                {/* Gastos */}
                <div className="bg-[#161b22] p-6 rounded-xl border border-slate-800 text-center">
                    <h3 className="text-rose-500 font-medium mb-1">Gastos Totales</h3>
                    <h2 className="text-3xl font-bold text-white mb-4">{formatEuro(totalExpenses)}</h2>
                    <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-slate-500"><span>Límite</span><span>{formatEuro(2000)}</span></div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-rose-500 h-full" style={{width: `${Math.min((totalExpenses/2000)*100, 100)}%`}}></div>
                    </div>
                    </div>
                </div>
            </div>

            {/* Barras de Progreso General */}
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

                {/* Barra Multicolor */}
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
                    <div className="flex justify-between text-[10px] text-slate-500 mt-2 px-1">
                        {CATEGORIES.map((cat, i) => (
                            <span key={i} className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[i]}}></div> {cat}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
            </div>

            {/* Columna Derecha (Gráfico Donut) */}
            <div className="md:col-span-3 flex flex-col gap-4">
            <div className="bg-[#161b22] p-6 rounded-xl border border-slate-800 text-center">
                <p className="text-slate-400 text-sm">Balance Neto (Mes)</p>
                <h2 className={`text-2xl font-bold mt-2 ${netIncome >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                    {formatEuro(netIncome)}
                </h2>
            </div>

            <div className="bg-[#161b22] p-4 rounded-xl border border-slate-800 flex-1 flex flex-col items-center justify-center">
                <h3 className="text-slate-300 text-sm mb-4">Desglose de Gastos</h3>
                <div className="w-full h-48 relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={donutData}
                                    cx="50%" cy="50%"
                                    innerRadius={40} outerRadius={60}
                                    paddingAngle={2}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {donutData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[CATEGORIES.indexOf(entry.name)]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip 
                                    formatter={(value: number) => formatEuro(value)}
                                    contentStyle={{backgroundColor: '#0d1117', borderColor: '#30363d', borderRadius: '8px'}} 
                                    itemStyle={{color: '#fff'}} 
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="text-xs font-bold text-slate-500">100%</span>
                        </div>
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

            {/* FILA INFERIOR (CATEGORÍAS) */}
            <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-5 gap-4 mt-2">
                {CATEGORIES.map((cat, index) => {
                    const total = categoryData.find(c => c.name === cat)?.value || 0;
                    const pieData = [
                        { name: 'Usado', value: total || 1 }, 
                        { name: 'Restante', value: (BUDGETS[cat] - total) > 0 ? (BUDGETS[cat] - total) : 0 }
                    ];
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
                                        <Pie
                                            data={pieData}
                                            cx="50%" cy="50%"
                                            innerRadius={30} outerRadius={38}
                                            startAngle={90} endAngle={-270}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            <Cell fill={color} />
                                            <Cell fill="#30363d" />
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-[10px] text-slate-400">% Ingreso</span>
                                    <span className="text-xs font-bold text-white">{((total/(income || 1))*100).toFixed(0)}%</span>
                                </div>
                            </div>

                            <div className="w-full space-y-2 mt-auto">
                                <div className="flex justify-between text-[10px] text-slate-400">
                                    <span>Progreso</span>
                                    <span>{pct.toFixed(0)}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, backgroundColor: color }}></div>
                                </div>
                                
                                <div className="flex justify-between text-[10px] pt-2 border-t border-slate-800 mt-2">
                                    <span className="text-slate-500">Presupuesto</span>
                                    <span className="text-white">{formatEuro(BUDGETS[cat])}</span>
                                </div>
                                <div className="flex justify-between text-[10px]">
                                    <span className="text-slate-500">Diferencia</span>
                                    <span className={BUDGETS[cat] - total >= 0 ? "text-emerald-400" : "text-rose-500"}>
                                        {formatEuro(BUDGETS[cat] - total)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </>
        ) : (
        /* --- VISTA DE HISTORIAL --- */
        <div className="md:col-span-9 bg-[#161b22] p-8 rounded-xl border border-slate-800">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <Calendar className="text-blue-500"/> Historial de Meses Anteriores
            </h2>
            
            {pastTransactions.length === 0 ? (
                <div className="text-center py-20 text-slate-500">
                    <p>No hay datos de meses anteriores todavía.</p>
                    <p className="text-sm mt-2">Cuando acabe {currentMonthName}, tus datos aparecerán aquí.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Aquí podríamos agrupar por mes, por ahora mostramos lista simple de pasados */}
                    <table className="w-full text-left text-slate-300">
                        <thead>
                            <tr className="border-b border-slate-700 text-slate-500 text-sm">
                                <th className="pb-2">Fecha</th>
                                <th className="pb-2">Concepto</th>
                                <th className="pb-2 text-right">Cantidad</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pastTransactions.map(t => (
                                <tr key={t.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                                    <td className="py-3 text-xs">{new Date(t.date || t.created_at).toLocaleDateString()}</td>
                                    <td className="py-3">{t.name} <span className="text-xs text-slate-500">({t.category})</span></td>
                                    <td className={`py-3 text-right font-bold ${t.type === 'income' ? 'text-emerald-400' : 'text-rose-500'}`}>
                                        {t.type === 'income' ? '+' : '-'}{formatEuro(t.amount)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
        )}

      </div>
    </div>
  );
}
