export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-label="Dashboard yükleniyor" style={{ padding: '28px 24px' }}>
      <div className="dashboard-skeleton dashboard-skeleton-title" />
      <div className="dashboard-skeleton-grid">
        {[1, 2, 3, 4].map((item) => <div className="dashboard-skeleton dashboard-skeleton-card" key={item} />)}
      </div>
      <div className="dashboard-skeleton dashboard-skeleton-flow" />
      <style>{`
        .dashboard-skeleton { background: #E2E8F0; border-radius: 10px; animation: dashboard-pulse 1.2s ease-in-out infinite; }
        .dashboard-skeleton-title { width: 260px; height: 32px; margin-bottom: 24px; }
        .dashboard-skeleton-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
        .dashboard-skeleton-card { height: 130px; }
        .dashboard-skeleton-flow { height: 260px; margin-top: 28px; }
        @media (max-width: 768px) { .dashboard-skeleton-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 390px) { .dashboard-skeleton-grid { grid-template-columns: 1fr; } }
        @keyframes dashboard-pulse { 50% { opacity: .45; } }
      `}</style>
    </div>
  );
}