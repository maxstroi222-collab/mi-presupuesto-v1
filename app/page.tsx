'use client'; // Esto permite interactividad (botones, formularios)

import { useEffect, useState } from 'react';
import { supabase } from './supabase'; // Importamos el conector que creaste
import { Wallet, TrendingUp, TrendingDown, Plus, Save } from 'lucide-react';

export default function Dashboard() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estado para el formulario (lo que escribes)
  const [newItem, setNewItem] = useState({ name: '', amount: '', type: 'expense', category: 'Otros' });

  // 1. Cargar datos al entrar
  useEffect(() => {
    fetchTransactions();
  }, []);

  async function fetchTransactions() {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('id', { ascending: false }); // Los más nuevos primero
    
    if (data) setTransactions(data);
    setLoading(false);
  }

  // 2. Función para guardar en Supabase
  async function handleAdd() {
    if (!newItem.name || !newItem.amount) return alert('Rellena nombre y cantidad');

    const { error } = await supabase
      .from('transactions')
      .insert([
        { 
          name: newItem.name, 
          amount: parseFloat(newItem.amount), 
          type: newItem.type, 
          category: newItem.category 
        }
      ]);

    if (error) {
      alert('Error al guardar: ' + error.message);
    } else {
      // Limpiar formulario y recargar lista
      setNewItem({ name: '', amount: '', type: 'expense', category: 'Otros' });
      fetchTransactions();
    }
  }

  // Cálculos automáticos
  const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const expense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const total = income - expense;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 p-4 md:p-8 font-sans">
      
      {/* --- FORMULARIO RÁPIDO --- */}
      <div className="bg-[#1e293b] p-6 rounded-2xl mb-8 border border-slate-700 shadow-2xl">
        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
          <Plus className="text-blue-400" /> Añadir Movimiento
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <input 
            type="text" 
            placeholder="Concepto (ej: Compra)" 
            className="p-3 rounded-lg bg-[#0f172a] border border-slate-700 text-white md:col-span-2"
            value={newItem.name}
            onChange={e => setNewItem({...newItem, name: e.target.value})}
          />
          <input 
            type="number" 
            placeholder="0.00" 
            className="p-3 rounded-lg bg-[#0f172a] border border-slate-700 text-white"
            value={newItem.amount}
            onChange={e => setNewItem({...newItem, amount: e.target.value})}
          />
          <select 
            className="p-3 rounded-lg bg-[#0f172a] border border-slate-700 text-white"
            value={newItem.type}
            onChange={e => setNewItem({...newItem, type: e.target.value})}
          >
            <option value="expense">Gasto (-)</option>
            <option value="income">Ingreso (+)</option>
          </select>
          <button 
            onClick={handleAdd}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all"
          >
            <Save size={18} /> Guardar
          </button>
        </div>
      </div>

      {/* --- RESUMEN DE CARTAS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Total */}
        <div className="bg-[#0f172a] border border-slate-800 p-6 rounded-2xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-500/20 rounded-lg"><Wallet className="text-blue-500" size={24}/></div>
            <span className="text-slate-400">Saldo Actual</span>
          </div>
          <h3 className="text-3xl font-bold text-white">${total.toFixed(2)}</h3>
        </div>
        {/* Ingresos */}
        <div className="bg-[#0f172a] border border-slate-800 p-6 rounded-2xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-500/20 rounded-lg"><TrendingUp className="text-emerald-500" size={24}/></div>
            <span className="text-slate-400">Ingresos</span>
          </div>
          <h3 className="text-3xl font-bold text-emerald-400">+${income.toFixed(2)}</h3>
        </div>
        {/* Gastos */}
        <div className="bg-[#0f172a] border border-slate-800 p-6 rounded-2xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-rose-500/20 rounded-lg"><TrendingDown className="text-rose-500" size={24}/></div>
            <span className="text-slate-400">Gastos</span>
          </div>
          <h3 className="text-3xl font-bold text-rose-500">-${expense.toFixed(2)}</h3>
        </div>
      </div>

      {/* --- LISTA DE MOVIMIENTOS --- */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-6">Últimos Movimientos</h3>
        <div className="space-y-4">
          {loading ? (
            <p className="text-slate-500 text-center">Cargando tus finanzas...</p>
          ) : transactions.map((item) => (
            <div key={item.id} className="flex justify-between items-center p-4 hover:bg-slate-900/50 rounded-xl transition-colors border-b border-slate-800/50 last:border-0">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${item.type === 'income' ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                  {item.type === 'income' ? <TrendingUp size={20} className="text-emerald-500"/> : <TrendingDown size={20} className="text-rose-500"/>}
                </div>
                <div>
                  <p className="font-medium text-white">{item.name}</p>
                  <p className="text-xs text-slate-500">{new Date(item.created_at || Date.now()).toLocaleDateString()}</p>
                </div>
              </div>
              <span className={`font-bold ${item.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {item.type === 'income' ? '+' : '-'}${item.amount}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
