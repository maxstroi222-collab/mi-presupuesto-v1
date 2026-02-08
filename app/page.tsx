'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from './supabase';
// IMPORTS PARA PDF
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { 
  Plus, Save, X, Trash2, LogOut, User, ChevronLeft, ChevronRight, 
  Calendar as CalendarIcon, Gamepad2, Search, Loader2, RefreshCw, Box, Shield, 
  Megaphone, Settings, Tag, Eye, EyeOff, TrendingDown, 
  Activity, CheckCircle, XCircle, Play, Terminal, Filter, FileText,
  Users, Ban, Lock, Unlock, Pencil, Clock, Repeat, CalendarDays, AlertTriangle, TrendingUp, AlertOctagon 
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
  const [scheduledPayments, setScheduledPayments] = useState<any[]>([]); 

  // ESTADOS DE UI GLOBAL
  const [privacyMode, setPrivacyMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // ESTADOS DE IMPERSONACIÓN (GOD MODE)
  const [impersonatedUser, setImpersonatedUser] = useState<{id: string, email: string} | null>(null);
  const impersonatingRef = useRef<{id: string, email: string} | null>(null);

  // SEMÁFORO PARA EVITAR COBROS DUPLICADOS
  const isProcessingRef = useRef(false);

  const [usersList, setUsersList] = useState<any[]>([]); 

  // MODALES Y EDICIÓN
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);

  const [showSteamForm, setShowSteamForm] = useState(false);
  const [showCatManager, setShowCatManager] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showUsersTable, setShowUsersTable] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false); 
  
  const [editingLimit, setEditingLimit] = useState<{id: number, name: string, amount: number} | null>(null);

  // Estados Admin y Config
  const [systemAlert, setSystemAlert] = useState({ message: '', active: false });
  const [adminMessageInput, setAdminMessageInput] = useState('');
  const [newSteamItem, setNewSteamItem] = useState({ name: '', quantity: '', price: '' });
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [refreshingSteam, setRefreshingSteam] = useState(false);

  // Diagnóstico
  const [diagnosticLogs, setDiagnosticLogs] = useState<{msg: string, status: 'info'|'success'|'error'}[]>([]);
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  // Formularios
  const [newItem, setNewItem] = useState({ name: '', amount: '', type: 'expense', category: '', date: new Date().toISOString().split('T')[0], tags: '' });
  const [newCatForm, setNewCatForm] = useState({ name: '', color: '#3b82f6', is_income: false, budget_limit: '0' });
  
  // Formulario Pago Programado
  const [selectedDay, setSelectedDay] = useState<number | null>(null); 
  const [newSchedule, setNewSchedule] = useState({ name: '', amount: '', category: '', is_recurring: true }); 

  // PDF Config
  const [pdfSelectedTags, setPdfSelectedTags] = useState<string[]>([]);

  // --- MÁQUINA DEL TIEMPO ---
  const [currentDate, setCurrentDate] = useState(new Date());
  const currentMonthIndex = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const goToPrevMonth = () => setCurrentDate(new Date(currentYear, currentMonthIndex - 1, 1));
  const goToNextMonth = () => setCurrentDate(new Date(currentYear, currentMonthIndex + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const currentMonthName = capitalize(currentDate.toLocaleString('es-ES', { month: 'long' }));
  
  // 1. CARGA INICIAL
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if(session) {
          loadAllData(session.user.id);
          processScheduledPayments(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (impersonatingRef.current) return; 

      setSession(session);
      if(session) {
          loadAllData(session.user.id);
          processScheduledPayments(session.user.id);
      } else { 
          setAllTransactions([]); setSteamItems([]); setCategories([]); 
      }
    });
    
    fetchSystemAlert();
    return () => subscription.unsubscribe();
  }, []);

  // --- REAL-TIME BAN CHECKER ---
  useEffect(() => {
    if (!session) return;
    const checkBanInterval = setInterval(async () => {
        if (impersonatingRef.current) return;
        const { data: isBanned, error } = await supabase.rpc('am_i_banned');
        if (!error && isBanned === true) {
            clearInterval(checkBanInterval);
            alert("🚫 TU CUENTA HA SIDO SUSPENDIDA POR EL ADMINISTRADOR.\n\nSe cerrará la sesión inmediatamente.");
            await supabase.auth.signOut();
            window.location.reload(); 
        }
    }, 4000); 
    return () => clearInterval(checkBanInterval);
  }, [session]);

  // --- LÓGICA DE AUTOMATIZACIÓN DE PAGOS (CON SEMÁFORO) ---
  async function processScheduledPayments(userId: string) {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true; 

      try {
          const { data: schedules } = await supabase.from('scheduled_payments').select('*').eq('user_id', userId);
          
          if(!schedules || schedules.length === 0) return;
          setScheduledPayments(schedules); 

          const today = new Date();
          const currentDay = today.getDate();
          const currentMonthStr = `${today.getFullYear()}-${(today.getMonth()+1).toString().padStart(2, '0')}`; 

          let processedCount = 0;

          for (const pay of schedules) {
              const lastProcessedMonth = pay.last_processed ? pay.last_processed.substring(0, 7) : '';
              
              if (currentDay >= pay.day_of_month && lastProcessedMonth !== currentMonthStr) {
                  const { data: freshData } = await supabase.from('scheduled_payments').select('last_processed').eq('id', pay.id).single();
                  const freshLastProcessed = freshData?.last_processed ? freshData.last_processed.substring(0, 7) : '';

                  if (freshLastProcessed === currentMonthStr) continue; 

                  await supabase.from('transactions').insert([{
                      user_id: userId,
                      name: `[Auto] ${pay.name}`,
                      amount: pay.amount,
                      type: 'expense', 
                      category: pay.category,
                      date: new Date().toISOString(),
                      tags: '#automatico' 
                  }]);

                  if (pay.is_recurring) {
                      await supabase.from('scheduled_payments').update({ last_processed: new Date().toISOString() }).eq('id', pay.id);
                  } else {
                      await supabase.from('scheduled_payments').delete().eq('id', pay.id);
                  }
                  
                  processedCount++;
              }
          }

          if (processedCount > 0) {
              alert(`✅ Se han generado ${processedCount} cargos automáticos.`);
              fetchTransactions(userId); 
              const { data } = await supabase.from('scheduled_payments').select('*').eq('user_id', userId);
              if(data) setScheduledPayments(data);
          }
      } catch (error) {
          console.error("Error procesando pagos:", error);
      }
  }

  async function loadAllData(userId: string) {
    const targetId = impersonatingRef.current ? impersonatingRef.current.id : userId;
    await fetchCategories(targetId);
    fetchTransactions(targetId);
    fetchSteamPortfolio(targetId);
    
    const { data } = await supabase.from('scheduled_payments').select('*').eq('user_id', targetId);
    if(data) setScheduledPayments(data);
  }

  // --- DATOS FILTRADOS ---
  const currentMonthTransactions = allTransactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === currentMonthIndex && d.getFullYear() === currentYear;
  });

  const displayedTransactions = currentMonthTransactions.filter(t => {
    const searchLower = searchQuery.toLowerCase();
    const matchName = t.name.toLowerCase().includes(searchLower);
    const matchTag = t.tags ? t.tags.toLowerCase().includes(searchLower) : false;
    return matchName || matchTag;
  });

  const income = currentMonthTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalExpenses = currentMonthTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const steamNetValue = steamItems.reduce((acc, i) => acc + (i.quantity * i.current_price), 0) * 0.85;
  const currentBalance = allTransactions.reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), 0);
  const netWorth = currentBalance + steamNetValue;

  const formatEuro = (amount: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
  
  const displayUserName = impersonatedUser 
      ? `(Viendo a) ${impersonatedUser.email}` 
      : (session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0]);

  // --- FUNCIONES GESTIÓN PAGOS PROGRAMADOS ---
  const getDaysInMonth = () => {
      const days = new Date(currentYear, currentMonthIndex + 1, 0).getDate();
      return Array.from({ length: days }, (_, i) => i + 1);
  };

  async function handleAddSchedule() {
      const uid = impersonatingRef.current ? impersonatingRef.current.id : session?.user?.id;
      if (!newSchedule.name || !newSchedule.amount || !uid || !selectedDay) return;

      await supabase.from('scheduled_payments').insert([{
          user_id: uid,
          name: newSchedule.name,
          amount: parseFloat(newSchedule.amount),
          category: newSchedule.category,
          day_of_month: selectedDay,
          is_recurring: newSchedule.is_recurring 
      }]);

      setNewSchedule({ name: '', amount: '', category: categories[0]?.name || '', is_recurring: true });
      setSelectedDay(null); 
      
      const { data } = await supabase.from('scheduled_payments').select('*').eq('user_id', uid);
      if(data) setScheduledPayments(data);
  }

  async function handleDeleteSchedule(id: string) {
      if(!confirm("¿Borrar este pago automático?")) return;
      await supabase.from('scheduled_payments').delete().eq('id', id);
      const uid = impersonatingRef.current ? impersonatingRef.current.id : session?.user?.id;
      const { data } = await supabase.from('scheduled_payments').select('*').eq('user_id', uid);
      if(data) setScheduledPayments(data);
  }

  // --- FUNCIONES ADMIN ---
  const fetchUsersList = async () => { const { data, error } = await supabase.rpc('get_admin_users_list'); if (data) setUsersList(data); if (error) alert("Error cargando usuarios: " + error.message); };
  const startImpersonation = (targetUser: any) => { if(!confirm(`¿Estás seguro de que quieres entrar como ${targetUser.email}?`)) return; const target = { id: targetUser.id, email: targetUser.email }; setImpersonatedUser(target); impersonatingRef.current = target; setUsersList([]); setShowUsersTable(false); setShowAdminPanel(false); loadAllData(target.id); };
  const stopImpersonation = () => { setImpersonatedUser(null); impersonatingRef.current = null; if (session) loadAllData(session.user.id); };
  const toggleBanUser = async (userId: string, currentStatus: boolean, email: string) => { if(!confirm(`¿${currentStatus ? 'Desbanear' : 'Banear'} a ${email}?`)) return; const { error } = await supabase.rpc('toggle_ban_user', { target_user_id: userId }); if(!error) fetchUsersList(); else alert("Error al banear: " + error.message); };
  
  // FUNCIÓN DE BORRADO
  const handleDeleteUser = async (userId: string, email: string) => {
      if (!confirm(`⚠️ ¡PELIGRO!\n\n¿Estás seguro de que quieres ELIMINAR a ${email}?\n\nEsta acción borrará TODOS sus datos (transacciones, categorías, steam) permanentemente y NO SE PUEDE DESHACER.`)) return;
      
      const { error } = await supabase.rpc('delete_user_by_admin', { target_user_id: userId });
      if (error) {
          alert("Error al borrar: " + error.message);
      } else {
          alert("Usuario eliminado correctamente.");
          fetchUsersList();
      }
  };

  // --- RESTO DE FUNCIONES ---
  async function fetchCategories(userId: string) { const { data } = await supabase.from('user_categories').select('*').eq('user_id', userId).order('created_at', { ascending: true }); if (data) { setCategories(data); if (data.length > 0 && !newItem.category) { setNewItem(prev => ({ ...prev, category: data[0].name })); setNewSchedule(prev => ({ ...prev, category: data[0].name })); } } }
  async function fetchTransactions(userId?: string) { const uid = userId || (impersonatingRef.current ? impersonatingRef.current.id : session?.user?.id); if(!uid) return; const { data } = await supabase.from('transactions').select('*').eq('user_id', uid).order('date', { ascending: false }); if (data) setAllTransactions(data); }
  async function fetchSteamPortfolio(userId?: string) { const uid = userId || (impersonatingRef.current ? impersonatingRef.current.id : session?.user?.id); if(!uid) return; const { data } = await supabase.from('steam_portfolio').select('*').eq('user_id', uid); if (data) setSteamItems(data); }
  async function handleCreateCategory() { const uid = impersonatingRef.current ? impersonatingRef.current.id : session?.user?.id; if (!newCatForm.name || !uid) return; await supabase.from('user_categories').insert([{ user_id: uid, name: newCatForm.name, color: newCatForm.color, is_income: newCatForm.is_income, budget_limit: parseFloat(newCatForm.budget_limit) || 0 }]); setNewCatForm({ name: '', color: '#3b82f6', is_income: false, budget_limit: '0' }); fetchCategories(uid); }
  async function handleDeleteCategory(id: number, name: string) { const uid = impersonatingRef.current ? impersonatingRef.current.id : session?.user?.id; if(confirm(`¿Borrar "${name}"?`)) { await supabase.from('user_categories').delete().eq('id', id); fetchCategories(uid); } }
  async function handleUpdateLimit() { const uid = impersonatingRef.current ? impersonatingRef.current.id : session?.user?.id; if (!editingLimit || !uid) return; await supabase.from('user_categories').update({ budget_limit: editingLimit.amount }).eq('id', editingLimit.id); setEditingLimit(null); fetchCategories(uid); }
  const parseSteamPrice = (priceStr: string) => { let clean = priceStr.replace('€', '').replace('$', '').replace(',', '.').trim(); clean = clean.replace('--', '00').replace('-', '00'); return parseFloat(clean); };
  async function getSteamPrice() { if(!newSteamItem.name) return; setFetchingPrice(true); try { const res = await fetch(`/api/steam?name=${encodeURIComponent(newSteamItem.name)}`); const data = await res.json(); const p = data.lowest_price || data.median_price; if (p) setNewSteamItem(prev => ({ ...prev, price: parseSteamPrice(p).toString() })); } catch (e) {} setFetchingPrice(false); }
  async function refreshAllSteamPrices() { setRefreshingSteam(true); for (const item of steamItems) { const res = await fetch(`/api/steam?name=${encodeURIComponent(item.item_name)}`); const data = await res.json(); const p = data.lowest_price || data.median_price; if (p) await supabase.from('steam_portfolio').update({ current_price: parseSteamPrice(p) }).eq('id', item.id); } const uid = impersonatingRef.current ? impersonatingRef.current.id : session?.user?.id; fetchSteamPortfolio(uid); setRefreshingSteam(false); }
  const handleEditTransaction = (t: any) => { setEditingTransaction(t); setNewItem({ name: t.name, amount: t.amount, type: t.type, category: t.category, date: new Date(t.date).toISOString().split('T')[0], tags: t.tags || '' }); setShowForm(true); };
  async function handleSaveTransaction() { const uid = impersonatingRef.current ? impersonatingRef.current.id : session?.user?.id; if (!newItem.name || !newItem.amount || !uid) return; const selectedCat = categories.find(c => c.name === newItem.category); const type = selectedCat?.is_income ? 'income' : 'expense'; if (editingTransaction) { await supabase.from('transactions').update({ name: newItem.name, amount: parseFloat(newItem.amount), type, category: newItem.category, date: new Date(newItem.date).toISOString(), tags: newItem.tags }).eq('id', editingTransaction.id); } else { await supabase.from('transactions').insert([{ user_id: uid, name: newItem.name, amount: parseFloat(newItem.amount), type, category: newItem.category, date: new Date(newItem.date).toISOString(), tags: newItem.tags }]); } setNewItem({ ...newItem, name: '', amount: '', tags: '' }); setEditingTransaction(null); setShowForm(false); fetchTransactions(uid); }
  async function handleDelete(id: number) { const uid = impersonatingRef.current ? impersonatingRef.current.id : session?.user?.id; if(confirm("¿Borrar?")) { await supabase.from('transactions').delete().eq('id', id); fetchTransactions(uid); } }
  async function handleAddSteam() { const uid = impersonatingRef.current ? impersonatingRef.current.id : session?.user?.id; if(!uid) return; await supabase.from('steam_portfolio').insert([{ user_id: uid, item_name: newSteamItem.name, quantity: parseInt(newSteamItem.quantity), current_price: parseFloat(newSteamItem.price) }]); setShowSteamForm(false); fetchSteamPortfolio(uid); }
  async function handleDeleteSteam(id: number) { const uid = impersonatingRef.current ? impersonatingRef.current.id : session?.user?.id; if(confirm("¿Borrar caja?")) { await supabase.from('steam_portfolio').delete().eq('id', id); fetchSteamPortfolio(uid); } }
  const generatePDF = () => { let dataToExport = currentMonthTransactions; let subtitle = "Informe Completo"; if (pdfSelectedTags.length > 0) { dataToExport = currentMonthTransactions.filter(t => { if (!t.tags) return false; return pdfSelectedTags.some(tag => t.tags.includes(tag)); }); subtitle = `Filtrado por: ${pdfSelectedTags.join(', ')}`; } const pdfIncome = dataToExport.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0); const pdfExpenses = dataToExport.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0); const doc = new jsPDF(); const title = `Informe: ${currentMonthName} ${currentYear}`; const dateStr = new Date().toLocaleString(); doc.setFontSize(18); doc.text(title, 14, 20); doc.setFontSize(10); doc.setTextColor(100); doc.text(subtitle, 14, 26); doc.setTextColor(0); doc.text(`Usuario: ${displayUserName}`, 14, 34); doc.text(`Generado: ${dateStr}`, 14, 39); autoTable(doc, { startY: 45, head: [['Resumen del Reporte', 'Valor']], body: [ ['Ingresos (Selección)', formatEuro(pdfIncome)], ['Gastos (Selección)', formatEuro(pdfExpenses)], ['Balance (Selección)', formatEuro(pdfIncome - pdfExpenses)], ], theme: 'striped', headStyles: { fillColor: [22, 27, 34] } }); doc.text("Movimientos Detallados", 14, (doc as any).lastAutoTable.finalY + 10); autoTable(doc, { startY: (doc as any).lastAutoTable.finalY + 15, head: [['Fecha', 'Concepto', 'Etiquetas', 'Importe']], body: dataToExport.map(t => [ new Date(t.date).toLocaleDateString('es-ES'), t.name, t.tags || '-', formatEuro(t.amount) ]), headStyles: { fillColor: [16, 185, 129] } }); doc.save(`Informe_${currentMonthName}_${currentYear}.pdf`); setShowPdfModal(false); };
  const getUniqueTags = () => { const allTags = currentMonthTransactions.map(t => t.tags).filter(t => t && t.trim() !== '').join(' ').split(' ').filter(t => t.startsWith('#')); return Array.from(new Set(allTags)); };
  async function fetchSystemAlert() { const { data } = await supabase.from('system_config').select('*').eq('key_name', 'global_alert').single(); if (data) { setSystemAlert({ message: data.value, active: data.is_active }); setAdminMessageInput(data.value); } }
  async function handleSaveAlert(active: boolean) { await supabase.from('system_config').update({ value: adminMessageInput, is_active: active }).eq('key_name', 'global_alert'); fetchSystemAlert(); }
  const runDiagnostics = async () => { if (isDiagnosing) return; setIsDiagnosing(true); setDiagnosticLogs([]); const addLog = (msg: string, status: 'info'|'success'|'error' = 'info') => setDiagnosticLogs(prev => [...prev, { msg, status }]); try { addLog("Iniciando diagnóstico...", 'info'); await new Promise(r => setTimeout(r, 600)); const { data: { session: s } } = await supabase.auth.getSession(); if (s) addLog("Sesión activa OK", 'success'); else throw new Error("Sin sesión"); addLog("Probando conexión DB...", 'info'); const { error } = await supabase.from('user_categories').select('id').limit(1); if (!error) addLog("DB Conectada", 'success'); else addLog("Error DB", 'error'); addLog("Probando Steam API...", 'info'); const res = await fetch('/api/steam?name=Recoil%20Case'); if(res.ok) addLog("Steam API OK", 'success'); else addLog("Fallo Steam API", 'error'); } catch(e: any) { addLog(e.message, 'error'); } finally { setIsDiagnosing(false); } };
  async function handleAuth() { setLoading(true); if (authMode === 'login') { const { data, error } = await supabase.auth.signInWithPassword({ email, password }); if (error) { alert(error.message); } else { const { data: banned } = await supabase.rpc('am_i_banned'); if(banned) { await supabase.auth.signOut(); alert("Esta cuenta está baneada por el administrador."); } } } else { const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } }); if (error) alert(error.message); else alert("Creado."); } setLoading(false); }
  const lastMonthDate = new Date(currentYear, currentMonthIndex - 1, 1);
  const lastMonthExpenses = allTransactions.filter(t => { const d = new Date(t.date); return t.type === 'expense' && d.getMonth() === lastMonthDate.getMonth() && d.getFullYear() === lastMonthDate.getFullYear(); }).reduce((acc, t) => acc + t.amount, 0);
  const comparisonData = [{ name: 'Mes Pasado', amount: lastMonthExpenses }, { name: 'Este Mes', amount: totalExpenses }];
  const blurClass = privacyMode ? 'blur-[10px] select-none transition-all' : 'transition-all';
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
      
      {impersonatedUser && (
         <div className="bg-orange-600/20 border-b border-orange-500 py-2 px-4 flex justify-between items-center text-orange-400 animate-pulse sticky top-0 z-[100]">
            <span className="font-bold flex items-center gap-2"><Eye size={18}/> VIENDO COMO: {impersonatedUser.email}</span>
            <button onClick={stopImpersonation} className="bg-orange-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-orange-500 transition flex items-center gap-1"><LogOut size={12}/> SALIR DEL MODO</button>
         </div>
      )}

      <div className="flex-1 p-4 md:p-6 relative">
          <button onClick={() => { setShowForm(true); setEditingTransaction(null); setNewItem({name: '', amount: '', type: 'expense', category: categories[0]?.name || '', date: new Date().toISOString().split('T')[0], tags: ''}); }} className="fixed bottom-8 right-8 z-50 bg-emerald-500 text-black font-bold p-4 rounded-full shadow-2xl hover:scale-110 transition-all"><Plus size={24} /></button>
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
                        <div className="bg-[#1e293b] border border-slate-600 rounded p-2">
                             <label className="text-xs text-slate-400 block mb-1">Tipo de Categoría</label>
                             <select className="w-full bg-transparent text-white text-sm outline-none cursor-pointer" value={newCatForm.is_income ? 'income' : 'expense'} onChange={e => setNewCatForm({...newCatForm, is_income: e.target.value === 'income'})}>
                                <option value="expense" className="bg-[#1e293b]">Gasto (Resta)</option>
                                <option value="income" className="bg-[#1e293b]">Ingreso (Suma)</option>
                             </select>
                        </div>
                        <div className="flex justify-between items-center"><input type="color" value={newCatForm.color} onChange={e => setNewCatForm({...newCatForm, color: e.target.value})}/><button onClick={handleCreateCategory} className="bg-emerald-600 px-4 py-2 rounded text-sm font-bold">Añadir</button></div>
                    </div>
                </div>
             </div>
          )}

          {/* CALENDARIO PAGOS PROGRAMADOS (ACTUALIZADO) */}
          {showScheduleModal && (
              <div className="fixed inset-0 bg-black/80 z-[65] flex items-center justify-center p-4">
                  <div className="bg-[#1e293b] p-6 rounded-2xl w-full max-w-lg border border-slate-700 max-h-[90vh] flex flex-col">
                      <div className="flex justify-between mb-4 border-b border-slate-700 pb-2">
                          <h3 className="font-bold text-xl flex items-center gap-2"><CalendarIcon/> Calendario de Pagos</h3>
                          <button onClick={() => setShowScheduleModal(false)}><X/></button>
                      </div>

                      {/* VISTA CALENDARIO */}
                      <div className="flex-1 overflow-y-auto custom-scrollbar">
                          {!selectedDay ? (
                            <div className="grid grid-cols-7 gap-2 text-center mb-4">
                                {['L','M','X','J','V','S','D'].map(d => <span key={d} className="text-slate-500 text-xs font-bold">{d}</span>)}
                                {getDaysInMonth().map(day => {
                                    // Buscar pagos para este día
                                    const dayPayments = scheduledPayments.filter(p => p.day_of_month === day);
                                    return (
                                        <button 
                                            key={day} 
                                            onClick={() => setSelectedDay(day)}
                                            className="aspect-square bg-[#0f172a] rounded border border-slate-700 hover:border-sky-500 transition relative flex flex-col items-center justify-start pt-1"
                                        >
                                            <span className="text-xs font-bold text-slate-300">{day}</span>
                                            <div className="flex gap-0.5 mt-1 flex-wrap justify-center px-1">
                                                {dayPayments.map((p, i) => (
                                                    <div 
                                                        key={i} 
                                                        className={`w-1.5 h-1.5 rounded-full ${p.is_recurring ? 'bg-sky-500' : 'bg-orange-500'}`} 
                                                        title={p.name}
                                                    />
                                                ))}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                          ) : (
                            // FORMULARIO DEL DÍA SELECCIONADO
                            <div className="bg-[#0f172a] p-4 rounded-lg border border-slate-700 animate-in fade-in slide-in-from-bottom-4">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-bold text-white flex gap-2"><CalendarDays size={18}/> Día {selectedDay}</h4>
                                    <button onClick={() => setSelectedDay(null)} className="text-xs text-sky-400 hover:underline">Volver al mes</button>
                                </div>
                                
                                {/* LISTA DE PAGOS DEL DÍA */}
                                <div className="space-y-2 mb-4">
                                    {scheduledPayments.filter(p => p.day_of_month === selectedDay).length === 0 && <p className="text-xs text-slate-500 italic">No hay pagos este día.</p>}
                                    {scheduledPayments.filter(p => p.day_of_month === selectedDay).map(pay => (
                                        <div key={pay.id} className="flex justify-between items-center bg-[#1e293b] p-2 rounded border border-slate-600">
                                            <div>
                                                <p className="font-bold text-sm">{pay.name}</p>
                                                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                                    {pay.is_recurring ? <Repeat size={10} className="text-sky-400"/> : <CalendarIcon size={10} className="text-orange-400"/>}
                                                    {pay.is_recurring ? 'Todos los meses' : 'Solo este mes'}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-mono">{formatEuro(pay.amount)}</span>
                                                <button onClick={() => handleDeleteSchedule(pay.id)} className="text-rose-500 hover:bg-rose-500/10 p-1 rounded"><Trash2 size={14}/></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="border-t border-slate-700 pt-4 space-y-3">
                                    <p className="text-xs font-bold text-emerald-400">Programar Nuevo Pago</p>
                                    <input className="w-full bg-[#1e293b] border border-slate-600 rounded p-2 text-sm" placeholder="Concepto (ej: Netflix)" value={newSchedule.name} onChange={e => setNewSchedule({...newSchedule, name: e.target.value})}/>
                                    <input type="number" className="w-full bg-[#1e293b] border border-slate-600 rounded p-2 text-sm" placeholder="Importe" value={newSchedule.amount} onChange={e => setNewSchedule({...newSchedule, amount: e.target.value})}/>
                                    <select className="w-full bg-[#1e293b] border border-slate-600 rounded p-2 text-sm" value={newSchedule.category} onChange={e => setNewSchedule({...newSchedule, category: e.target.value})}>
                                        {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                    </select>
                                    
                                    {/* SELECTOR DE FRECUENCIA */}
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => setNewSchedule({...newSchedule, is_recurring: true})}
                                            className={`flex-1 py-2 text-xs rounded border ${newSchedule.is_recurring ? 'bg-sky-600 text-white border-sky-500' : 'bg-[#1e293b] text-slate-400 border-slate-600'}`}
                                        >
                                            Todos los meses
                                        </button>
                                        <button 
                                            onClick={() => setNewSchedule({...newSchedule, is_recurring: false})}
                                            className={`flex-1 py-2 text-xs rounded border ${!newSchedule.is_recurring ? 'bg-orange-600 text-white border-orange-500' : 'bg-[#1e293b] text-slate-400 border-slate-600'}`}
                                        >
                                            Solo este mes
                                        </button>
                                    </div>

                                    <button onClick={handleAddSchedule} className="w-full bg-emerald-600 font-bold py-2 rounded text-sm hover:bg-emerald-500">Guardar</button>
                                </div>
                            </div>
                          )}
                      </div>
                      
                      <div className="mt-4 pt-2 border-t border-slate-700 flex justify-between text-[10px] text-slate-400">
                          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-sky-500"></div> Recurrente</span>
                          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-500"></div> Un solo pago</span>
                      </div>
                  </div>
              </div>
          )}

          {/* MODAL PDF CONFIG */}
          {showPdfModal && (
            <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4">
              <div className="bg-[#1e293b] p-6 rounded-2xl w-full max-w-sm border border-slate-700">
                <div className="flex justify-between mb-4"><h3 className="font-bold flex items-center gap-2"><FileText size={20}/> Generar Informe</h3><button onClick={() => setShowPdfModal(false)}><X/></button></div>
                <p className="text-sm text-slate-400 mb-4">Selecciona qué gastos quieres incluir:</p>
                <div className="bg-[#0d1117] p-3 rounded border border-slate-800 mb-4 max-h-40 overflow-y-auto custom-scrollbar">
                    <label className="flex items-center gap-2 p-2 hover:bg-slate-800 rounded cursor-pointer">
                        <input type="checkbox" checked={pdfSelectedTags.length === 0} onChange={() => setPdfSelectedTags([])}/>
                        <span className="text-sm font-bold text-white">Todo (Completo)</span>
                    </label>
                    <div className="h-px bg-slate-700 my-1"></div>
                    {getUniqueTags().map(tag => (
                        <label key={tag} className="flex items-center gap-2 p-2 hover:bg-slate-800 rounded cursor-pointer">
                            <input type="checkbox" checked={pdfSelectedTags.includes(tag)} onChange={(e) => {if(e.target.checked) setPdfSelectedTags([...pdfSelectedTags, tag]); else setPdfSelectedTags(pdfSelectedTags.filter(t => t !== tag));}}/>
                            <span className="text-sm text-sky-400">{tag}</span>
                        </label>
                    ))}
                    {getUniqueTags().length === 0 && <p className="text-xs text-slate-500 italic p-2">No hay etiquetas este mes.</p>}
                </div>
                <button onClick={generatePDF} className="w-full bg-emerald-600 font-bold py-3 rounded-lg hover:bg-emerald-500 transition">Generar PDF</button>
              </div>
            </div>
          )}

          {/* MODAL ADMIN */}
          {showAdminPanel && (
            <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4">
               <div className="bg-[#1e293b] p-6 rounded-2xl w-full max-w-2xl border border-red-500/30 flex flex-col max-h-[90vh]">
                  <div className="flex justify-between mb-6 border-b border-slate-700 pb-4"><h3 className="font-bold text-xl text-red-400 flex items-center gap-2"><Shield size={24}/> Admin Panel</h3><button onClick={() => setShowAdminPanel(false)}><X/></button></div>
                  <div className="overflow-y-auto space-y-6">
                      
                      <button onClick={() => { fetchUsersList(); setShowUsersTable(true); }} className="w-full bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center hover:bg-slate-700 transition group">
                          <div className="flex items-center gap-3"><div className="bg-sky-500/20 p-2 rounded-lg"><Users className="text-sky-400"/></div><div className="text-left"><p className="font-bold text-white">Gestionar Usuarios</p><p className="text-xs text-slate-400">Ver listado, impersonar y banear</p></div></div>
                          <ChevronRight className="text-slate-500 group-hover:text-white"/>
                      </button>

                      <div className="space-y-4"><h4 className="text-white font-bold flex items-center gap-2"><Megaphone size={18} className="text-amber-400"/> Aviso Global</h4><textarea className="w-full bg-[#0f172a] border border-slate-600 rounded p-3 h-20 text-sm" value={adminMessageInput} onChange={(e) => setAdminMessageInput(e.target.value)}/><div className="flex gap-2"><button onClick={() => handleSaveAlert(true)} className="flex-1 bg-emerald-600/20 text-emerald-400 border border-emerald-600/50 py-2 rounded font-bold">Publicar</button><button onClick={() => handleSaveAlert(false)} className="flex-1 bg-slate-700/20 text-slate-400 border border-slate-600/50 py-2 rounded font-bold">Ocultar</button></div></div>
                      <div className="space-y-4 pt-4 border-t border-slate-700">
                          <div className="flex justify-between items-center"><h4 className="text-white font-bold flex items-center gap-2"><Activity size={18} className="text-sky-400"/> Consola</h4><button onClick={runDiagnostics} className="bg-sky-600 px-3 py-1 rounded text-xs font-bold">Test</button></div>
                          <div className="bg-black p-4 rounded h-64 overflow-y-auto font-mono text-xs custom-scrollbar">
                              {diagnosticLogs.length === 0 ? <div className="text-slate-500 italic flex items-center gap-2"><Terminal size={14}/> Esperando comando...</div> : diagnosticLogs.map((log, i) => (
                                  <div key={i} className="flex gap-2 items-start mb-1">
                                      <span className="text-slate-500">[{new Date().toLocaleTimeString().split(' ')[0]}]</span>
                                      {log.status === 'info' && <span className="text-blue-400">{log.msg}</span>}
                                      {log.status === 'success' && <span className="text-emerald-400 flex items-center gap-1"><CheckCircle size={12}/> {log.msg}</span>}
                                      {log.status === 'error' && <span className="text-rose-500 flex items-center gap-1 font-bold"><XCircle size={12}/> {log.msg}</span>}
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
               </div>
            </div>
          )}

          {/* MODAL LISTA DE USUARIOS (CON BAN Y BORRAR) */}
          {showUsersTable && (
            <div className="fixed inset-0 bg-black/90 z-[80] flex items-center justify-center p-4">
                <div className="bg-[#1e293b] p-6 rounded-2xl w-full max-w-5xl border border-slate-700 h-[80vh] flex flex-col">
                    <div className="flex justify-between mb-4 border-b border-slate-700 pb-2">
                        <h3 className="font-bold text-xl flex items-center gap-2 text-white"><Users className="text-sky-400"/> Usuarios Registrados</h3>
                        <button onClick={() => setShowUsersTable(false)}><X className="text-slate-400 hover:text-white"/></button>
                    </div>
                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-slate-500 text-xs uppercase border-b border-slate-700">
                                    <th className="p-3">Email</th>
                                    <th className="p-3">Último Acceso</th>
                                    <th className="p-3 text-center">Transacciones</th>
                                    <th className="p-3 text-center">Estado</th>
                                    <th className="p-3 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {usersList.length === 0 ? (
                                    <tr><td colSpan={5} className="p-4 text-center text-slate-500 italic">Cargando o sin permisos...</td></tr>
                                ) : (
                                    usersList.map((user: any) => (
                                        <tr key={user.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition">
                                            <td className="p-3 text-sm font-bold text-white">
                                                {user.email}
                                                {user.is_banned && <span className="ml-2 text-[10px] bg-red-500/20 text-red-400 px-1 rounded border border-red-500/30">BANEADO</span>}
                                            </td>
                                            <td className="p-3 text-xs text-slate-400">{new Date(user.last_sign_in_at).toLocaleDateString()}</td>
                                            <td className="p-3 text-xs text-slate-400 text-center">{user.total_transactions || 0}</td>
                                            <td className="p-3 text-center">
                                                {user.is_banned ? <Lock size={14} className="mx-auto text-red-500"/> : <Unlock size={14} className="mx-auto text-emerald-500"/>}
                                            </td>
                                            <td className="p-3 text-right flex justify-end gap-2">
                                                <button 
                                                    onClick={() => handleDeleteUser(user.id, user.email)}
                                                    className="bg-rose-950/40 hover:bg-rose-600 text-rose-500 hover:text-white border border-rose-500/30 px-3 py-1 rounded text-xs font-bold transition flex items-center gap-2"
                                                    title="Eliminar usuario permanentemente"
                                                >
                                                    <Trash2 size={12}/>
                                                </button>
                                                <button 
                                                    onClick={() => toggleBanUser(user.id, user.is_banned, user.email)}
                                                    className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-2 border ${user.is_banned ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/50' : 'bg-red-600/20 text-red-400 border-red-500/50'}`}
                                                >
                                                    <Ban size={12}/> {user.is_banned ? 'Desbanear' : 'Banear'}
                                                </button>
                                                <button 
                                                    onClick={() => startImpersonation(user)}
                                                    className="bg-sky-600/20 hover:bg-sky-600 text-sky-400 hover:text-white border border-sky-500/50 px-3 py-1 rounded text-xs font-bold transition flex items-center gap-2"
                                                >
                                                    <Eye size={12}/> Ver Como
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
          )}

          {/* MODAL TRANSACCION (EDITAR / CREAR) */}
          {showForm && (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
              <div className="bg-[#1e293b] p-6 rounded-2xl w-full max-w-md border border-slate-700 space-y-4">
                <div className="flex justify-between">
                    <h3 className="font-bold">{editingTransaction ? 'Editar Movimiento' : 'Añadir Movimiento'}</h3>
                    <button onClick={() => { setShowForm(false); setEditingTransaction(null); }}><X/></button>
                </div>
                <input type="date" className="w-full bg-[#0f172a] border border-slate-600 rounded p-3" value={newItem.date} onChange={e => setNewItem({...newItem, date: e.target.value})} />
                <input className="w-full bg-[#0f172a] border border-slate-600 rounded p-3" placeholder="Concepto" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})}/>
                <input type="number" className="w-full bg-[#0f172a] border border-slate-600 rounded p-3" placeholder="Importe" value={newItem.amount} onChange={e => setNewItem({...newItem, amount: e.target.value})}/>
                <input className="w-full bg-[#0f172a] border border-slate-600 rounded p-3 text-sm" placeholder="Etiquetas (ej: #vacaciones #fiesta)" value={newItem.tags} onChange={e => setNewItem({...newItem, tags: e.target.value})}/>
                <div className="grid grid-cols-2 gap-2">
                     <div className="bg-[#0f172a] border border-slate-600 rounded p-3 text-slate-400 text-center text-sm flex items-center justify-center">
                        {categories.find(c => c.name === newItem.category)?.is_income ? 'Ingreso (+)' : 'Gasto (-)'}
                     </div>
                    <select className="bg-[#0f172a] border border-slate-600 rounded p-3 text-white" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})}>{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select>
                </div>
                <button onClick={handleSaveTransaction} className="w-full bg-emerald-500 text-black font-bold py-3 rounded-lg">{editingTransaction ? 'Actualizar' : 'Guardar'}</button>
              </div>
            </div>
          )}

          {/* LAYOUT PRINCIPAL */}
          <div className="max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-6 pb-20">
            <div className="md:col-span-12 bg-[#161b22] p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="bg-slate-800 p-3 rounded-full"><User className={isAdmin ? "text-red-500" : "text-emerald-400"} size={24} /></div>
                    <div><p className="text-slate-400 text-xs">Bienvenido</p><h2 className="text-lg font-bold">{displayUserName}</h2></div>
                    <button onClick={() => setShowCatManager(true)} className="bg-slate-800 p-2 rounded-lg text-slate-300 border border-slate-700 flex gap-2 text-xs"><Tag size={14}/> Categorías</button>
                    {/* BOTÓN NUEVO PAGOS PROGRAMADOS */}
                    <button onClick={() => setShowScheduleModal(true)} className="bg-slate-800 p-2 rounded-lg text-slate-300 border border-slate-700 flex gap-2 text-xs"><Clock size={14}/> Automáticos</button>
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
              
              <div className="bg-[#161b22] p-4 rounded-xl border border-slate-800 h-[140px]">
                 <h3 className="font-bold text-xs mb-2 flex gap-2"><TrendingDown size={14} className="text-rose-500"/> Comparativa</h3>
                 <ResponsiveContainer width="100%" height={80}>
                    <BarChart layout="vertical" data={comparisonData} margin={{ left: 40, right: 45 }}>
                        <XAxis type="number" hide domain={[0, 'auto']} />
                        <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false}/>
                        <RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '8px'}} itemStyle={{color: '#fff', fontSize:'12px'}} formatter={(value:any) => formatEuro(value)}/>
                        <Bar dataKey="amount" fill="#f43f5e" barSize={18} radius={[0, 4, 4, 0]}>
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
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold flex gap-2"><Gamepad2 className="text-sky-400"/> Steam</h3>
                        <div className="flex gap-2">
                            <button onClick={refreshAllSteamPrices} disabled={refreshingSteam} className="bg-slate-700 px-2 rounded">
                                <RefreshCw size={12} className={refreshingSteam ? "animate-spin" : ""} />
                            </button>
                            <button onClick={() => setShowSteamForm(true)} className="text-[10px] bg-sky-500/10 text-sky-400 px-2 py-1 rounded">+ Caja</button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 overflow-y-auto custom-scrollbar">
                        {steamItems.map(item => (
                            <div key={item.id} className="bg-[#0d1117] p-2 rounded border border-slate-800 relative group h-20 flex flex-col justify-between">
                                <button onClick={() => handleDeleteSteam(item.id)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100"><Trash2 size={10}/></button>
                                <p className="text-[10px] truncate">{item.item_name}</p>
                                <div className="flex justify-between items-end">
                                    <div className="text-[9px] text-slate-500 flex flex-col"><span>{item.quantity} ud.</span><span>{formatEuro(item.current_price)}/u</span></div>
                                    <p className={`text-xs font-bold text-sky-400 ${blurClass}`}>{formatEuro(item.quantity * item.current_price * 0.85)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="md:col-span-4 bg-[#161b22] rounded-xl border border-slate-800 p-4 flex flex-col h-[400px]">
                <div className="flex justify-between items-center mb-4 gap-2">
                    <h3 className="font-bold flex gap-2 whitespace-nowrap"><CalendarIcon className="text-slate-400"/> Historial</h3>
                    <div className="flex items-center bg-[#0d1117] border border-slate-700 rounded px-2 py-1 flex-1 mx-2">
                        <Search size={12} className="text-slate-500 mr-2"/>
                        <input className="bg-transparent text-xs text-white outline-none w-full placeholder:text-slate-600" placeholder="Buscar (ej: #fiesta)" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                    <button onClick={() => setShowPdfModal(true)} className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded border border-emerald-500/30 font-bold hover:bg-emerald-500 hover:text-black transition flex items-center gap-1"><FileText size={12}/> PDF</button>
                </div>

                <div className="overflow-y-auto flex-1 space-y-2 custom-scrollbar">
                    {displayedTransactions.length === 0 ? (
                        <p className="text-center text-slate-600 text-xs py-10">No hay movimientos.</p>
                    ) : (
                        displayedTransactions.map(t => (
                            <div key={t.id} className="flex justify-between items-center p-2 rounded bg-[#0d1117] border border-slate-800 group text-xs">
                                <div>
                                    <p className="font-medium flex items-center gap-2">{t.name}{t.tags && <span className="text-[9px] text-sky-400 bg-sky-900/20 px-1 rounded">{t.tags}</span>}</p>
                                    <p className="text-[9px] text-slate-500">{t.category}</p>
                                </div>
                                <div className="flex gap-2">
                                    <span className={`${t.type==='income'?'text-emerald-400':'text-rose-500'} ${blurClass}`}>{formatEuro(t.type === 'income' ? t.amount : -t.amount)}</span>
                                    
                                    {/* BOTONES DE EDICIÓN Y BORRADO */}
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleEditTransaction(t)} className="text-slate-500 hover:text-white"><Pencil size={12}/></button>
                                        <button onClick={() => handleDelete(t.id)} className="text-slate-500 hover:text-rose-500"><Trash2 size={12}/></button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="md:col-span-12 grid grid-cols-2 md:grid-cols-5 gap-4">
                {categories.map((cat) => {
                    // FILTRO DE NÓMINA: Si se llama Nomina o Nómina, no renderiza este bloque.
                    if (['nomina', 'nómina'].includes(cat.name.toLowerCase())) return null;

                    const used = currentMonthTransactions.filter(t => t.category === cat.name && t.type === (cat.is_income ? 'income' : 'expense')).reduce((acc, t) => acc + t.amount, 0);
                    const limit = cat.budget_limit || 0;
                    
                    // CÁLCULO DE EXCESO / META SUPERADA
                    const isOverLimit = limit > 0 && used > limit;
                    const excessAmount = used - limit;
                    const excessPct = limit > 0 ? ((excessAmount / limit) * 100) : 0;
                    const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
                    
                    // LOGICA DE COLORES
                    // Si es gasto y te pasas -> Rojo (Malo)
                    // Si es ingreso y te pasas -> Verde/Oro (Bueno)
                    let chartColor = cat.color;
                    let percentageText = `${pct.toFixed(0)}%`;
                    let statusIcon = null;

                    if (isOverLimit) {
                        if (cat.is_income) {
                             chartColor = '#fbbf24'; // Un dorado/ambar para "Logro desbloqueado"
                             percentageText = `+${excessPct.toFixed(0)}%`;
                             statusIcon = <TrendingUp size={10}/>;
                        } else {
                             chartColor = '#f43f5e'; // Rojo alarma
                             percentageText = `+${excessPct.toFixed(0)}%`;
                             statusIcon = <AlertTriangle size={10}/>;
                        }
                    }

                    return (
                        <div key={cat.id} className="bg-[#161b22] p-4 rounded-xl border border-slate-800 flex flex-col items-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1" style={{backgroundColor: chartColor}}></div>
                            
                            <h3 className="text-xs font-bold mb-1 uppercase truncate w-full text-center" style={{color: chartColor}}>
                                {cat.name}
                            </h3>
                            
                            <div className="w-16 h-16 relative mb-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie 
                                            data={isOverLimit ? [{v:1},{v:0}] : [{v:used||1},{v:Math.max(limit-used,0)}]} 
                                            cx="50%" cy="50%" innerRadius={20} outerRadius={26} startAngle={90} endAngle={-270} 
                                            dataKey="v" stroke="none"
                                        >
                                            <Cell fill={chartColor} className={isOverLimit && !cat.is_income ? "animate-pulse" : ""} />
                                            <Cell fill="#30363d"/>
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold ${isOverLimit && !cat.is_income ? 'text-rose-500' : 'text-white'}`}>
                                    {percentageText}
                                </div>
                            </div>
                            
                            <p className={`text-lg font-bold ${blurClass}`}>{formatEuro(used)}</p>
                            
                            {/* BOTÓN INFERIOR CON INFORMACIÓN DE LÍMITE */}
                            <button onClick={() => setEditingLimit({id: cat.id, name: cat.name, amount: limit})} className="text-[9px] text-slate-500 mt-1 w-full text-center">
                                {isOverLimit ? (
                                    <span className={`${cat.is_income ? 'text-amber-400' : 'text-rose-500'} font-bold flex items-center justify-center gap-1`}>
                                        {statusIcon} 
                                        Límite: <span className={blurClass}>{formatEuro(limit)}</span> 
                                        (<span className={blurClass}>{cat.is_income ? '+' : '-'}{formatEuro(excessAmount)}</span>)
                                    </span>
                                ) : (
                                    <span>Límite: <span className={blurClass}>{formatEuro(limit)}</span></span>
                                )}
                            </button>
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
