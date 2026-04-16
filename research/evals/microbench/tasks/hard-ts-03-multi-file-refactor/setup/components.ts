import { UserData } from "./types";

export function renderUserCard(user: UserData): string {
  return `
    <div class="user-card">
      <img src="${user.avatar}" alt="${user.name}" />
      <h2>${user.name}</h2>
      <p>${user.email}</p>
      <span class="role">${user.role}</span>
    </div>
  `;
}

export function renderUserList(users: UserData[]): string {
  return `
    <div class="user-list">
      ${users.map((user: UserData) => renderUserCard(user)).join("")}
    </div>
  `;
}

export function renderUserProfile(user: UserData): string {
  return `
    <div class="user-profile">
      <img src="${user.avatar}" alt="${user.name}" class="profile-avatar" />
      <h1>${user.name}</h1>
      <p>Email: ${user.email}</p>
      <p>Role: ${user.role}</p>
      <p>Theme: ${user.preferences.theme}</p>
      <p>Language: ${user.preferences.language}</p>
      <p>Last Login: ${user.lastLogin}</p>
      <p>Status: ${user.isActive ? "Active" : "Inactive"}</p>
    </div>
  `;
}
