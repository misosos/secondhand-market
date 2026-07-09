import { AccountStatus, Role } from "./enums";

// Never includes `password`. This is the shape the API is allowed to return.
export interface PublicUser {
  id: string;
  username: string;
  bio: string | null;
  status: AccountStatus;
  role: Role;
  balance: number;
  createdAt: string;
}

// Tokens themselves never reach the client anymore — they're issued as
// httpOnly cookies (see apps/api's AuthController) that JS can't read.
export interface LoginResponse {
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

// Admin-only view — a superset of PublicUser with moderation-relevant
// fields (reportCount) that regular profile views don't need to expose.
export interface AdminUserDto {
  id: string;
  username: string;
  status: AccountStatus;
  role: Role;
  balance: number;
  reportCount: number;
  createdAt: string;
}

export interface SetUserStatusRequest {
  status: AccountStatus;
}
