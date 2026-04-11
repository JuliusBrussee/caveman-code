export async function fetchData(url: string): Promise<unknown> {
	const response = await fetch(url);
	return response.json();
}

export async function requestData(url: string): Promise<unknown> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}
	return response.json();
}
