import { useEffect, useState } from 'react'

type ApiStatus = 'checking' | 'ready' | 'error'

type HealthResponse = {
  status: string
  database?: string
}

function App() {
  const [apiStatus, setApiStatus] =
    useState<ApiStatus>('checking')

  useEffect(() => {
    const controller = new AbortController()

    async function checkApiHealth() {
      try {
        const response = await fetch('/api/health', {
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error('API health check failed')
        }

        const data = (await response.json()) as HealthResponse

        if (
          data.status !== 'ok' ||
          data.database !== 'connected'
        ) {
          throw new Error('Invalid API health response')
        }

        if (!controller.signal.aborted) {
          setApiStatus('ready')
        }
      } catch {
        if (!controller.signal.aborted) {
          setApiStatus('error')
        }
      }
    }

    void checkApiHealth()

    return () => {
      controller.abort()
    }
  }, [])

  const apiStatusText = {
    checking: 'Memeriksa koneksi API...',
    ready: 'API dan database terhubung',
    error: 'API belum terhubung',
  }[apiStatus]

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
          FONDASI APLIKASI
        </div>

        <h1>FTU Dashboard berhasil dijalankan.</h1>

        <p className="description">
          Frontend React, Laravel API, dan MySQL
          sedang dipersiapkan untuk sistem
          pemantauan proyek engineering.
        </p>

        <div className="status-row">
          <span className="status-badge">
            Frontend siap
          </span>

          <span
            className={
              apiStatus === 'ready'
                ? 'status-badge'
                : 'status-note'
            }
            role="status"
          >
            {apiStatusText}
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