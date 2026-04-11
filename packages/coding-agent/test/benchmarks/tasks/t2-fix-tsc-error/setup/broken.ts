interface User {
	id: number;
	name: string;
	email: string;
	isActive: boolean;
}

function getActiveUsers(users: User[]): User[] {
	return users.filter((user) => user.active); // Bug: should be user.isActive
}

function getUserEmail(user: User): string {
	return user.mail; // Bug: should be user.email
}

function createUser(name: string, email: string): User {
	return {
		id: Math.random(),
		name,
		email,
		isActive: true,
	};
}

export { getActiveUsers, getUserEmail, createUser };
export type { User };
