interface User {
  name: string;
  age: number;
  email: string;
}

function createUser(name: string, age: number, email: string): User {
  return { name, age, email };
}

const alice: User = {
  name: "Alice",
  age: "twenty-five",
  email: "alice@example.com",
};

function greetUser(user: User): string {
  return `Hello, ${user.name}! You are ${user.age} years old.`;
}

console.log(greetUser(alice));
