export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ backgroundColor: '#0f172a', color: 'white', margin: 0, fontFamily: 'sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
