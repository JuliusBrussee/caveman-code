import { UserData, UserDataResponse } from "./types";

export async function fetchUserData(id: string): Promise<UserData> {
  const response = await fetch(`/api/users/${id}`);
  const data: UserData = await response.json();
  return data;
}

export async function fetchAllUserData(page: number): Promise<UserDataResponse> {
  const response = await fetch(`/api/users?page=${page}`);
  const result: UserDataResponse = await response.json();
  return result;
}

export async function updateUserData(id: string, userData: Partial<UserData>): Promise<UserData> {
  const response = await fetch(`/api/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userData),
  });
  const updated: UserData = await response.json();
  return updated;
}

export async function deleteUserData(id: string): Promise<void> {
  await fetch(`/api/users/${id}`, { method: "DELETE" });
}
