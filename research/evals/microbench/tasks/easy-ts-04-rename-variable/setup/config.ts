const apiUrl = "https://api.example.com/v1";

function getEndpoint(path: string): string {
  return `${apiUrl}/${path}`;
}

function getUsersUrl(): string {
  return `${apiUrl}/users`;
}

function getPostsUrl(): string {
  return `${apiUrl}/posts`;
}

export { apiUrl, getEndpoint, getUsersUrl, getPostsUrl };
