import { Email } from './email';

export type UserRole = 'user' | 'admin';

export interface UserProps {
  id: string;
  email: Email;
  passwordHash: string;
  displayName: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export class User {
  readonly id: string;
  readonly email: Email;
  readonly role: UserRole;
  readonly createdAt: Date;
  passwordHash: string;
  displayName: string;
  updatedAt: Date;

  constructor(props: UserProps) {
    this.id = props.id;
    this.email = props.email;
    this.passwordHash = props.passwordHash;
    this.displayName = props.displayName;
    this.role = props.role;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static register(input: { id: string; email: Email; passwordHash: string; displayName: string; now: Date }): User {
    return new User({
      id: input.id,
      email: input.email,
      passwordHash: input.passwordHash,
      displayName: input.displayName.trim(),
      role: 'user',
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  rename(displayName: string, now: Date): void {
    this.displayName = displayName.trim();
    this.updatedAt = now;
  }

  changePasswordHash(passwordHash: string, now: Date): void {
    this.passwordHash = passwordHash;
    this.updatedAt = now;
  }
}
