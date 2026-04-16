const API_BASE = "https://api.example.com";

export function getUsers(): Promise<any[]> {
  return fetch(`${API_BASE}/users`)
    .then((r) => r.json())
    .then((data) => data.users);
}

export function getUserById(id: string): Promise<any> {
  return fetch(`${API_BASE}/users/${id}`)
    .then((r) => r.json());
}

export function createUser(name: string, email: string): Promise<any> {
  return fetch(`${API_BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email }),
  })
    .then((r) => r.json());
}
