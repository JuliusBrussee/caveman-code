import { UserData, createDefaultUserData } from "./types";

export function isValidUserData(user: UserData): boolean {
  return (
    typeof user.id === "string" &&
    user.id.length > 0 &&
    typeof user.name === "string" &&
    user.name.length > 0 &&
    typeof user.email === "string" &&
    user.email.includes("@")
  );
}

export function mergeUserData(base: UserData, overrides: Partial<UserData>): UserData {
  return { ...base, ...overrides };
}

export function formatUserData(user: UserData): string {
  return `${user.name} <${user.email}> [${user.role}]`;
}

export function sortUserData(users: UserData[], key: keyof UserData): UserData[] {
  return [...users].sort((a, b) => {
    const aVal = String(a[key]);
    const bVal = String(b[key]);
    return aVal.localeCompare(bVal);
  });
}

export function filterActiveUserData(users: UserData[]): UserData[] {
  return users.filter((user: UserData) => user.isActive);
}

export function createTestUserData(overrides: Partial<UserData> = {}): UserData {
  const base = createDefaultUserData();
  return { ...base, id: "test-id", name: "Test User", email: "test@example.com", ...overrides };
}
