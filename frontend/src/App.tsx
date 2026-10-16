function App() {
  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div
          className="logo-placeholder"
          aria-label="Tempat logo FTU"
        >
          Logo FTU
          <span>Belum dipasang</span>
        </div>

        <div className="brand-info">
          <strong>PT Filosofi Teknik Utama</strong>
          <span>Dashboard Divisi Engineering</span>
        </div>
      </header>

      <section className="dashboard-card">
        <div className="section-label">
          FONDASI FRONTEND
        </div>

        <h1>FTU Dashboard berhasil dijalankan.</h1>

        <p className="description">
          Aplikasi React dan TypeScript telah
          berhasil disiapkan melalui Docker dan Nginx.
        </p>

        <div className="status-row">
          <span className="status-badge">
            Frontend siap
          </span>

          <span className="status-note">
            Data proyek akan tersedia setelah API dibuat.
          </span>
        </div>
      </section>

      <footer className="dashboard-footer">
        Halaman pengujian sistem — Belum menggunakan data perusahaan
      </footer>
    </main>
  )
}

export default App