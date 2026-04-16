import { UserData, UserDataList } from "./types";

interface UserStore {
  users: UserDataList;
  currentUser: UserData | null;
  isLoading: boolean;
}

const initialState: UserStore = {
  users: [],
  currentUser: null,
  isLoading: false,
};

export class UserDataStore {
  private state: UserStore = { ...initialState };

  getUsers(): UserDataList {
    return this.state.users;
  }

  getCurrentUser(): UserData | null {
    return this.state.currentUser;
  }

  setCurrentUser(user: UserData): void {
    this.state.currentUser = user;
  }

  addUser(user: UserData): void {
    this.state.users.push(user);
  }

  removeUser(id: string): void {
    this.state.users = this.state.users.filter((u: UserData) => u.id !== id);
  }

  updateUser(id: string, updates: Partial<UserData>): void {
    const index = this.state.users.findIndex((u: UserData) => u.id === id);
    if (index >= 0) {
      this.state.users[index] = { ...this.state.users[index], ...updates };
    }
  }
}
