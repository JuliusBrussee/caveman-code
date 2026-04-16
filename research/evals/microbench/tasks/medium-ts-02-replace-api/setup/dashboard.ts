const DASHBOARD_API = "https://api.example.com/dashboard";

export function loadDashboardStats(): Promise<any> {
  return fetch(`${DASHBOARD_API}/stats`)
    .then((r) => r.json())
    .then((data) => ({
      totalUsers: data.totalUsers,
      activeUsers: data.activeUsers,
      revenue: data.revenue,
    }));
}

export function loadRecentActivity(): Promise<any[]> {
  return fetch(`${DASHBOARD_API}/activity?limit=10`)
    .then((r) => r.json())
    .then((data) => data.activities);
}
