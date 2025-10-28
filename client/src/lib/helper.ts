
export function isAdmin(user?: { role: string }) {
  return user?.role === "admin";
}

export function isManager(user?: { role:string }) {
  return user?.role === "manager";
}

export function isEmployee(user?: { role: string }) {
  return user?.role === "employee";
}
