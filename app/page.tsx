'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { 
  Wallet, TrendingUp, TrendingDown, Plus, Save, 
  Target, Zap, Landmark, PiggyBank, CreditCard 
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend 
} from 'recharts';

export default function Dashboard() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Categorías basadas en tu imagen
  const CATEGORIES = ['Variable', 'Facturas', 'Deuda', 'Inversiones', 'Ahorro'];
  
  const [newItem, setNewItem] = useState({ 
    name: '', amount: '', type: 'expense', category: 'Variable' 
  });

  useEffect(() => {
    fetchTransactions();
  }, []);

  async function fetchTransactions() {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .order('id', { ascending: false });
    if (data) setTransactions(data);
    setLoading(false);
  }

  async function handleAdd() {
    if (!newItem.name || !newItem.amount) return;
    await supabase.from('transactions').insert([{ 
      name: newItem.name, 
      amount: parseFloat(newItem.amount), 
      type: newItem.type, 
      category: newItem.category 
    }]);
    setNewItem({ name: '', amount: '', type: 'expense', category: 'Variable' });
    fetchTransactions();
  }

  // --- CÁLCULOS MATEMÁTICOS ---
  const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const netIncome = income - totalExpenses;

  // Agrupar gastos por categoría para los gráficos
  const expensesByCategory = CATEGORIES.map(cat => {
    const total = transactions
      .filter(t => t.type === 'expense' && t.category === cat)
      .reduce((acc, t) => acc + t.amount, 0);
    return { name: cat, value: total };
  });

  // Colores para el gráfico circular (Neon Style)
  const COLORS = ['#f43f5e', '#fbbf24', '#3b82f6', '#8b5cf6', '#10b981'];

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 p-4 font-sans">
      
      {/* HEADER TIPO DASHBOARD */}
      <header className="flex justify-between items-center mb-8 bg-[#1e293b] p-4 rounded-xl border border-slate-700 shadow-lg">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard Financiero</h1>
          <p className="text-emerald-400 text-sm">Septiembre 2026</p>
        </div>
        <div className="text-right">
           <p className="text-xs text-slate-400">Saldo Neto Disponible</p>
           <h2 className={`text-3xl font-bold ${netIncome >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
             ${netIncome.toFixed(2)}
           </h2>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* --- COLUMNA IZQUIERDA (RESUMEN) --- */}
        <div className="lg:col-span-3 space-y-6">
            {/* Tarjeta de Ingresos */}
            <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-800 border-t-4 border-t-emerald-500">
                <p className="text-slate-400 mb-1">Total Ingresos</p>
                <h3 className="text-2xl font-bold text-white">${income.toFixed(2)}</h3>
                <div className="mt-4 text-xs text-slate-500 flex justify-between">
                    <span>Presupuesto: $7,200</span>
                    <span className="text-emerald-400">+{((income/7200)*100).toFixed(0)}%</span>
                </div>
                {/* Barra de progreso visual */}
                <div className="w-full bg-slate-700 h-2 rounded-full mt-2">
                    <div className="bg-emerald-500 h-2 rounded-full" style={{width: `${Math.min((income/7200)*100, 100)}%`}}></div>
                </div>
            </div>

            {/* Tarjeta de Gastos */}
            <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-800 border-t-4 border-t-rose-500">
                <p className="text-slate-400 mb-1">Total Gastos</p>
                <h3 className="text-2xl font-bold text-white">${totalExpenses.toFixed(2)}</h3>
                <div className="mt-4 text-xs text-slate-500 flex justify-between">
                    <span>Límite: $5,000</span>
                    <span className="text-rose-400">{((totalExpenses/5000)*100).toFixed(0)}%</span>
                </div>
                <div className="w-full bg-slate-700 h-2 rounded-full mt-2">
                    <div className="bg-rose-500 h-2 rounded-full" style={{width: `${Math.min((totalExpenses/5000)*100, 100)}%`}}></div>
                </div>
            </div>

            {/* Formulario Rápido (Integrado en el lateral) */}
            <div className="bg-[#1e293b] p-5 rounded-xl border border-slate-700">
                <h4 className="font-bold text-white mb-4 flex items-center gap-2">
                    <Plus size={16} className="text-blue-400"/> Nuevo Movimiento
                </h4>
                <div className="space-y-3">
                    <input 
                        className="w-full bg-[#0f172a] border border-slate-600 rounded p-2 text-sm text-white" 
                        placeholder="Nombre (ej: Luz)" 
                        value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})}
                    />
                    <input 
                        type="number" className="w-full bg-[#0f172a] border border-slate-600 rounded p-2 text-sm text-white" 
                        placeholder="0.00" 
                        value={newItem.amount} onChange={e => setNewItem({...newItem, amount: e.target.value})}
                    />
                    <div className="flex gap-2">
                        <select 
                            className="bg-[#0f172a] border border-slate-600 rounded p-2 text-sm text-white w-1/2"
                            value={newItem.type} onChange={e => setNewItem({...newItem, type: e.target.value})}
                        >
                            <option value="expense">Gasto</option>
                            <option value="income">Ingreso</option>
                        </select>
                        <select 
                            className="bg-[#0f172a] border border-slate-600 rounded p-2 text-sm text-white w-1/2"
                            value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})}
                        >
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <button onClick={handleAdd} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded text-sm transition">
                        Añadir
                    </button>
                </div>
            </div>
        </div>

        {/* --- COLUMNA CENTRAL Y DERECHA (GRÁFICOS) --- */}
        <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Gráfico Principal: Breakdown de Gastos */}
            <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-800 md:col-span-2 flex flex-col md:flex-row items-center justify-between">
                <div className="w-full md:w-1/2">
                    <h3 className="text-lg font-bold text-white mb-2">Desglose de Gastos</h3>
                    <p className="text-slate-400 text-sm mb-6">Visualización de dónde va tu dinero.</p>
                    <ul className="space-y-2">
                        {expensesByCategory.map((entry, index) => (
                            <li key={index} className="flex items-center justify-between text-sm text-slate-300 border-b border-slate-700/50 pb-1">
                                <span className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[index % COLORS.length]}}></span>
                                    {entry.name}
                                </span>
                                <span className="font-mono font-bold">${entry.value.toFixed(0)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="w-full md:w-1/2 h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={expensesByCategory}
                                cx="50%" cy="50%"
                                innerRadius={60} outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {expensesByCategory.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '8px'}} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* --- TARJETAS DE CATEGORÍAS (COMO EN LA FOTO) --- */}
            {expensesByCategory.map((cat, index) => {
                // Presupuestos ficticios (Simulados para que se vea bien)
                const budgets = { 'Variable': 1200, 'Facturas': 800, 'Deuda': 500, 'Inversiones': 300, 'Ahorro': 200 };
                // @ts-ignore
                const budget = budgets[cat.name] || 500;
                const percentage = Math.min((cat.value / budget) * 100, 100);
                
                // Iconos dinámicos
                const icons = [<Target key="1"/>, <Zap key="2"/>, <CreditCard key="3"/>, <TrendingUp key="4"/>, <PiggyBank key="5"/>];

                return (
                    <div key={index} className="bg-[#1e293b] p-6 rounded-xl border border-slate-800 relative overflow-hidden group hover:border-slate-600 transition">
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 rounded-lg bg-opacity-20 text-white`} style={{backgroundColor: `${COLORS[index]}33`, color: COLORS[index]}}>
                                {icons[index]}
                            </div>
                            <span className="text-xs text-slate-500 uppercase tracking-wider">{cat.name}</span>
                        </div>
                        
                        <div className="flex justify-between items-end mb-2">
                            <h3 className="text-2xl font-bold text-white">${cat.value}</h3>
                            <span className="text-xs text-slate-400">Meta: ${budget}</span>
                        </div>

                        {/* Barra de Progreso Circular Simulada con CSS lineal */}
                        <div className="w-full bg-slate-700 h-1.5 rounded-full mb-2">
                            <div className="h-1.5 rounded-full transition-all duration-1000" style={{width: `${percentage}%`, backgroundColor: COLORS[index]}}></div>
                        </div>
                        <p className={`text-xs ${percentage > 100 ? 'text-rose-500' : 'text-emerald-400'} text-right`}>
                            {percentage.toFixed(0)}% del presupuesto
                        </p>
                    </div>
                )
            })}
        </div>
      </div>
      
      {/* Últimos movimientos (Tabla simple abajo) */}
      <div className="mt-8 bg-[#1e293b] rounded-xl border border-slate-800 p-6">
        <h3 className="text-white font-bold mb-4">Historial Reciente</h3>
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-400">
                <thead>
                    <tr className="border-b border-slate-700">
                        <th className="pb-2">Nombre</th>
                        <th className="pb-2">Categoría</th>
                        <th className="pb-2 text-right">Cantidad</th>
                    </tr>
                </thead>
                <tbody>
                    {transactions.slice(0, 5).map(t => (
                        <tr key={t.id} className="border-b border-slate-800/50">
                            <td className="py-3 text-white">{t.name}</td>
                            <td className="py-3"><span className="px-2 py-1 rounded bg-[#0f172a] text-xs">{t.category}</span></td>
                            <td className={`py-3 text-right font-bold ${t.type==='income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {t.type==='income' ? '+' : '-'}${t.amount}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}
