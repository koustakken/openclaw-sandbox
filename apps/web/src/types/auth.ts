export type AuthUser = {
  id: string;
  email: string;
  createdAt?: string;
};

export type AuthResponse = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};
