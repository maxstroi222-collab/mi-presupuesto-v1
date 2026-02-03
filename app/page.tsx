'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { Plus, Save, X } from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, 
  Legend 
} from 'recharts';

export default function Dashboard() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  
  // --- LÓGICA DE FECHA AUTOMÁTICA ---
  // Obtenemos la fecha actual
  const now = new Date();
  // Obtenemos el nombre del mes en español (ej: "febrero")
  const monthName = now.toLocaleString('es-ES', { month: 'long' });
  // Ponemos la primera letra en mayúscula (ej: "Febrero")
  const currentMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  const currentYear = now.getFullYear();

  // Colores exactos de la imagen
  const THEME = {
    bg: '#0d1117',        
    card: '#161b22',      
    text: '#ffffff',
    textDim: '#8b949e',
    variable: '#f43f5e',  
    bills: '#fbbf24',     
    debt: '#3b82f6',      
    investments: '#8b5cf6', 
    savings: '#10b981',   
  };

  const CATEGORIES = ['Variable', 'Bills', 'Debt', 'Investments', 'Savings'];
  
  // Presupuestos "Goal" simulados
  const BUDGETS: any = { 
    'Variable': 2420, 
    'Bills': 1805, 
    'Debt': 1890, 
    'Investments': 425, 
    'Savings': 600 
  };

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
    setShowForm(false);
    fetchTransactions();
  }

  // --- CÁLCULOS ---
  const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const netIncome = income - totalExpenses;

  // Datos por categoría
  const categoryData = CATEGORIES.map(cat => {
    const value = transactions
      .filter(t => t.type === 'expense' && t.category === cat)
      .reduce((acc, t) => acc + t.amount, 0);
    return { name: cat, value };
  });

  const donutData = categoryData.filter(c => c.value > 0);
  const COLORS = [THEME.variable, THEME.bills, THEME.debt, THEME.investments, THEME.savings];

  return (
    <div className="min-h-screen p-4 md:p-6 font-sans text-white" style={{ backgroundColor: THEME.bg }}>
      
      {/* Botón flotante */}
      <button 
        onClick={() => setShowForm(true)}
        className="fixed bottom-8 right-8 z-50 bg-emerald-500 hover:bg-emerald-400 text-black font-bold p-4 rounded-full shadow-2xl transition-all transform hover:scale-110"
      >
        <Plus size={24} />
      </button>

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
                  <option value="expense">Gasto</option>
                  <option value="income">Ingreso</option>
                </select>
                <select 
                  className="bg-[#0f172a] border border-slate-600 rounded p-3 text-white"
                  value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})}
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button onClick={handleAdd} className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-lg flex justify-center gap-2">
                <Save size={20}/> Guardar Transacción
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- GRID PRINCIPAL --- */}
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-4">
        
        {/* 1. COLUMNA IZQUIERDA (FECHA AUTOMÁTICA) */}
        <div className="md:col-span-3 space-y-4">
          
          {/* AQUÍ ESTÁ EL CAMBIO DE LA FECHA */}
          <div className="bg-[#161b22] p-6 rounded-xl border border-slate-800 text-center">
             <h1 className="text-3xl font-light text-white">{currentMonth}</h1>
             <p className="text-slate-500 text-xs uppercase tracking-widest mt-1">- {currentYear} Dashboard -</p>
          </div>
          
          <div className="bg-[#161b22] p-4 rounded-xl border border-slate-800 flex justify-between items-center">
             <span className="text-slate-400 text-xs">Saldo Inicial</span>
             <span className="text-white font-mono">$2,001.67</span>
          </div>
          
          <div className="bg-[#161b22] p-6 rounded-xl border border-slate-800 text-center">
             <p className="text-slate-400 text-xs mb-2">Saldo Proyectado</p>
             <h2 className="text-2xl font-bold text-white">${(2001.67 + netIncome).toFixed(2)}</h2>
          </div>

          <div className="bg-[#161b22] p-6 rounded-xl border border-slate-800 text-center relative overflow-hidden">
             <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-500"></div>
             <p className="text-slate-400 text-xs mb-2">Saldo Actual</p>
             <h2 className="text-2xl font-bold text-white">${(2001.67 + netIncome).toFixed(2)}</h2>
          </div>
        </div>

        {/* 2. ZONA CENTRAL */}
        <div className="md:col-span-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 h-full">
             <div className="bg-[#161b22] p-6 rounded-xl border border-slate-800 text-center">
                <h3 className="text-emerald-400 font-medium mb-1">Total Income</h3>
                <h2 className="text-3xl font-bold text-white mb-4">${income.toFixed(2)}</h2>
                <div className="space-y-2 text-xs">
                   <div className="flex justify-between text-slate-500"><span>Budget</span><span>$7,200.00</span></div>
                   <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-white h-full" style={{width: '90%'}}></div>
                   </div>
                   <div className="flex justify-between text-white mt-1"><span>Actual</span><span className="text-emerald-400">${income.toFixed(2)}</span></div>
                   <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full" style={{width: '100%'}}></div>
                   </div>
                </div>
             </div>

             <div className="bg-[#161b22] p-6 rounded-xl border border-slate-800 text-center">
                <h3 className="text-rose-500 font-medium mb-1">Total Expenses</h3>
                <h2 className="text-3xl font-bold text-white mb-4">${totalExpenses.toFixed(2)}</h2>
                <div className="space-y-2 text-xs">
                   <div className="flex justify-between text-slate-500"><span>Budget</span><span>$7,140.00</span></div>
                   <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-white h-full" style={{width: '95%'}}></div>
                   </div>
                   <div className="flex justify-between text-white mt-1"><span>Actual</span><span className="text-rose-500">${totalExpenses.toFixed(2)}</span></div>
                   <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-rose-500 h-full" style={{width: `${Math.min((totalExpenses/7140)*100, 100)}%`}}></div>
                   </div>
                </div>
             </div>
          </div>

          <div className="bg-[#161b22] p-6 rounded-xl border border-slate-800 flex flex-col justify-center gap-6">
             <div>
                <div className="flex justify-center gap-4 text-xs mb-2">
                   <span className="flex items-center gap-1"><div className="w-2 h-2 bg-emerald-500"></div> Total Income</span>
                   <span className="flex items-center gap-1"><div className="w-2 h-2 bg-rose-500"></div> Total Expenses</span>
                </div>
                <div className="w-full h-4 bg-slate-800 rounded-full flex overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{width: '55%'}}></div>
                    <div className="h-full bg-rose-500" style={{width: '45%'}}></div>
                </div>
             </div>

             <div>
                 <div className="w-full h-8 bg-slate-800 rounded flex overflow-hidden">
                     {categoryData.map((cat, i) => (
                         <div key={i} style={{ width: `${(cat.value / totalExpenses) * 100}%`, backgroundColor: COLORS[i] }} 
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

        {/* 3. COLUMNA DERECHA */}
        <div className="md:col-span-3 flex flex-col gap-4">
           <div className="bg-[#161b22] p-6 rounded-xl border border-slate-800 text-center">
               <p className="text-slate-400 text-sm">Net Income</p>
               <h2 className={`text-2xl font-bold mt-2 ${netIncome >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                   ${netIncome.toFixed(2)}
               </h2>
           </div>

           <div className="bg-[#161b22] p-4 rounded-xl border border-slate-800 flex-1 flex flex-col items-center justify-center">
               <h3 className="text-slate-300 text-sm mb-4">Total Expenses Breakdown</h3>
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
                            <RechartsTooltip contentStyle={{backgroundColor: '#0d1117', borderColor: '#30363d', borderRadius: '8px'}} itemStyle={{color: '#fff'}} />
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

        {/* 4. FILA INFERIOR */}
        <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-5 gap-4 mt-2">
            {CATEGORIES.map((cat, index) => {
                const total = categoryData.find(c => c.name === cat)?.value || 0;
                const pieData = [
                    { name: 'Used', value: total || 1 }, 
                    { name: 'Remaining', value: (BUDGETS[cat] - total) > 0 ? (BUDGETS[cat] - total) : 0 }
                ];
                const pct = Math.min((total / BUDGETS[cat]) * 100, 100);
                const color = COLORS[index];

                return (
                    <div key={cat} className="bg-[#161b22] p-4 rounded-xl border border-slate-800 flex flex-col items-center relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-full h-1" style={{backgroundColor: color}}></div>
                        
                        <h3 className="text-sm font-bold mb-1" style={{color: color}}>{cat}</h3>
                        <h2 className="text-xl font-bold text-white mb-4">${total.toFixed(2)}</h2>
                        
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
                                 <span className="text-[10px] text-slate-400">% Income</span>
                                 <span className="text-xs font-bold text-white">{((total/income)*100 || 0).toFixed(0)}%</span>
                             </div>
                        </div>

                        <div className="w-full space-y-2 mt-auto">
                            <div className="flex justify-between text-[10px] text-slate-400">
                                <span>Goal Progress</span>
                                <span>{pct.toFixed(0)}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, backgroundColor: color }}></div>
                            </div>
                            
                            <div className="flex justify-between text-[10px] pt-2 border-t border-slate-800 mt-2">
                                <span className="text-slate-500">Budget</span>
                                <span className="text-white">${BUDGETS[cat]}</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                                <span className="text-slate-500">Difference</span>
                                <span className={BUDGETS[cat] - total >= 0 ? "text-emerald-400" : "text-rose-500"}>
                                    ${(BUDGETS[cat] - total).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>

      </div>
    </div>
  );
}
