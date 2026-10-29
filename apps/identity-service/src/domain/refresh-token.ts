export interface RefreshTokenProps {
  id: string;
  userId: string;
  /** All tokens created by rotation from one login share a family id. */
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
  createdAt: Date;
}

export class RefreshToken {
  readonly id: string;
  readonly userId: string;
  readonly familyId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly replacedById: string | null;
  readonly createdAt: Date;

  constructor(props: RefreshTokenProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.familyId = props.familyId;
    this.tokenHash = props.tokenHash;
    this.expiresAt = props.expiresAt;
    this.revokedAt = props.revokedAt;
    this.replacedById = props.replacedById;
    this.createdAt = props.createdAt;
  }

  static issue(input: { id: string; userId: string; familyId: string; tokenHash: string; now: Date; ttlMs: number }): RefreshToken {
    return new RefreshToken({
      id: input.id,
      userId: input.userId,
      familyId: input.familyId,
      tokenHash: input.tokenHash,
      expiresAt: new Date(input.now.getTime() + input.ttlMs),
      revokedAt: null,
      replacedById: null,
      createdAt: input.now,
    });
  }

  isRevoked(): boolean {
    return this.revokedAt !== null;
  }

  isExpired(now: Date): boolean {
    return this.expiresAt.getTime() <= now.getTime();
  }
}
