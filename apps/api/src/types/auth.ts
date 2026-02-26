export type User = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
};

export type PublicUser = Omit<User, 'passwordHash'>;
