import { AccountStatus } from "./enums";

// Never includes `password`. This is the shape the API is allowed to return.
export interface PublicUser {
  id: string;
  username: string;
  bio: string | null;
  status: AccountStatus;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse extends AuthTokens {
  user: PublicUser;
}

export interface SignupRequest {
  username: string;
  password: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface UpdateProfileRequest {
  bio?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
