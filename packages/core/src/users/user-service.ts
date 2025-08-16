import type { Logger, User } from "@bip/domain";
import type { UserRepository, UserStats } from "./user-repository";

export class UserService {
  constructor(
    protected readonly repository: UserRepository,
    protected readonly logger: Logger,
  ) {}

  async find(id: string): Promise<User | null> {
    return this.repository.findById(id);
  }

  async findMany(): Promise<User[]> {
    return this.repository.findMany();
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.repository.findBySlug(username);
  }

  async update(id: string, data: Partial<User>): Promise<User | null> {
    return this.repository.update(id, data);
  }

  async getUserStats(userId?: string): Promise<UserStats[]> {
    return this.repository.getUserStats(userId);
  }

  async getTopUsersByMetric(metric: "reviews" | "attendance" | "ratings", limit: number = 10): Promise<UserStats[]> {
    return this.repository.getTopUsersByMetric(metric, limit);
  }

  async getCommunityTotals() {
    return this.repository.getCommunityTotals();
  }
}
