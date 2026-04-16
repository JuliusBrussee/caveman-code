const ANALYTICS_URL = "https://api.example.com/analytics";

export function trackEvent(event: string, payload: Record<string, any>): Promise<void> {
  return fetch(`${ANALYTICS_URL}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, payload, timestamp: Date.now() }),
  })
    .then((r) => r.json())
    .then(() => undefined);
}

export function getEventCounts(startDate: string, endDate: string): Promise<any> {
  return fetch(`${ANALYTICS_URL}/counts?start=${startDate}&end=${endDate}`)
    .then((r) => r.json());
}
