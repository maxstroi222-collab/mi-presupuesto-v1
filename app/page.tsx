export default function Page() {
  return (
    <div style={{ padding: '40px' }}>
      <h1 style={{ color: '#10b981' }}>Mi Dashboard Financiero</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px' }}>
          <p>Total Ingresos</p>
          <h2 style={{ color: '#10b981' }}>$7,660.74</h2>
        </div>
        <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px' }}>
          <p>Total Gastos</p>
          <h2 style={{ color: '#f43f5e' }}>$7,441.15</h2>
        </div>
      </div>
    </div>
  )
}
