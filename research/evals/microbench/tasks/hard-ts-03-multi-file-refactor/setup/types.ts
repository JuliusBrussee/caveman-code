export interface UserData {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: "admin" | "editor" | "viewer";
  preferences: {
    theme: "light" | "dark";
    notifications: boolean;
    language: string;
  };
  lastLogin: Date;
  isActive: boolean;
}

export type UserDataList = UserData[];

export interface UserDataResponse {
  users: UserData[];
  total: number;
  page: number;
}

export function createDefaultUserData(): UserData {
  return {
    id: "",
    name: "",
    email: "",
    avatar: "",
    role: "viewer",
    preferences: {
      theme: "light",
      notifications: true,
      language: "en",
    },
    lastLogin: new Date(),
    isActive: true,
  };
}
