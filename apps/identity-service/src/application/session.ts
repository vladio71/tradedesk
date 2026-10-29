import { User } from '../domain/user';

/** What a successful login or refresh gives back to the HTTP layer. */
export interface Session {
  user: User;
  accessToken: string;
  refreshToken: string;
}
