interface UserData {
  id: number;
  name: string;
  email: string;
}

async function fetchUserData(userId: number): Promise<UserData> {
  const response = await fetch(`https://api.example.com/users/${userId}`);
  const data = await response.json();
  return data as UserData;
}

export { fetchUserData };
