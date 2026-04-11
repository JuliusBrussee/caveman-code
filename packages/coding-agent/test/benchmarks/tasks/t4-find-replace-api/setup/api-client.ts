import { fetchData } from "./http";

export async function getUsers() {
	return fetchData("/api/users");
}

export async function getUser(id: string) {
	return fetchData(`/api/users/${id}`);
}

export async function getPosts() {
	return fetchData("/api/posts");
}
