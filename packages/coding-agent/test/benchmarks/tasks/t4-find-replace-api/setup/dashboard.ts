import { fetchData } from "./http";

export async function loadDashboard() {
	const stats = await fetchData("/api/stats");
	const recent = await fetchData("/api/recent");
	return { stats, recent };
}
