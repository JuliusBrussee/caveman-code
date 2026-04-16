interface User {
  id: string;
  name: string;
  email: string;
}

const users: Map<string, User> = new Map();

// TODO: wire up events

export class UserService {
  createUser(name: string, email: string): User {
    const id = Math.random().toString(36).substring(2, 10);
    const user: User = { id, name, email };
    users.set(id, user);
    return user;
  }

  getUser(id: string): User | undefined {
    return users.get(id);
  }

  deleteUser(id: string): boolean {
    const user = users.get(id);
    if (!user) return false;
    users.delete(id);
    return true;
  }

  listUsers(): User[] {
    return Array.from(users.values());
  }
}
