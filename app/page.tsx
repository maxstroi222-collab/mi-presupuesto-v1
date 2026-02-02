import React from 'react';
import { Wallet, TrendingUp, TrendingDown, CreditCard, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 p-4 md:p-8">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-white">Mi Control Financiero</h1>
        <p className="text-slate-400">Resumen general de tus cuentas</p>
      </header>

      {/* Grid de Tarjetas Superiores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Saldo Actual */}
        <div className="bg-[#0f172a] border border-slate-800 p-6 rounded-2xl shadow-xl">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Wallet className="text-blue-500" size={24} />
            </div>
          </div>
          <p className="text-slate-400 text-sm">Saldo Total</p>
          <h3 className="text-3xl font-bold text-white mt-1">$12,450.00</h3>
          <div className="flex items-center mt-4 text-emerald-400 text-sm">
            <ArrowUpRight size={16} className="mr-1" />
            <span>+2.5% este mes</span>
          </div>
        </div>

        {/* Ingresos */}
        <div className="bg-[#0f172a] border border-slate-800 p-6 rounded-2xl">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <TrendingUp className="text-emerald-500" size={24} />
            </div>
          </div>
          <p className="text-slate-400 text-sm">Ingresos Mensuales</p>
          <h3 className="text-3xl font-bold text-white mt-1">$7,660.74</h3>
        </div>

        {/* Gastos */}
        <div className="bg-[#0f172a] border border-slate-800 p-6 rounded-2xl">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-rose-500/10 rounded-lg">
              <TrendingDown className="text-rose-500" size={24} />
            </div>
          </div>
          <p className="text-slate-400 text-sm">Gastos Mensuales</p>
          <h3 className="text-3xl font-bold text-white mt-1">$4,120.30</h3>
        </div>
      </div>

      {/* Cuerpo Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Gráfico (Simulado con bloques por ahora) */}
        <div className="lg:col-span-2 bg-[#0f172a] border border-slate-800 p-6 rounded-2xl">
          <h3 className="text-lg font-semibold mb-6">Actividad de Gastos</h3>
          <div className="h-64 w-full bg-slate-800/20 rounded-xl flex items-end justify-around p-4">
            {/* Simulación de barras */}
            {[40, 70, 45, 90, 65, 80, 30].map((h, i) => (
              <div key={i} style={{ height: `${h}%` }} className="w-8 bg-blue-600/40 rounded-t-sm border-t-2 border-blue-400"></div>
            ))}
          </div>
        </div>

        {/* Últimos Movimientos */}
        <div className="bg-[#0f172a] border border-slate-800 p-6 rounded-2xl">
          <h3 className="text-lg font-semibold mb-6">Últimos Gastos</h3>
          <div className="space-y-6">
            {[
              { name: 'Suscripción Netflix', cat: 'Entretenimiento', price: '-$15.99', color: 'text-rose-400' },
              { name: 'Compra Mercadona', cat: 'Alimentación', price: '-$84.20', color: 'text-rose-400' },
              { name: 'Nómina Empresa', cat: 'Sueldo', price: '+$2,400', color: 'text-emerald-400' },
            ].map((item, i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center mr-3">
                    <CreditCard size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{item.name}</p>
                    <p className="text-xs text-slate-500">{item.cat}</p>
                  </div>
                </div>
                <span className={`text-sm font-bold ${item.color}`}>{item.price}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
