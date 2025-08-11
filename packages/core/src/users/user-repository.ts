import type { User, UserMinimal } from "@bip/domain";
import type { DbClient, DbUser } from "../_shared/database/models";
import { buildOrderByClause, buildWhereClause } from "../_shared/database/query-utils";
import type { QueryOptions } from "../_shared/database/types";

export interface UserStats {
  user: User;
  reviewCount: number;
  attendanceCount: number;
  ratingCount: number;
  averageRating: number | null;
}

export function mapUserToDomainEntity(dbUser: DbUser): User {
  return {
    id: dbUser.id,
    username: dbUser.username ?? "",
    email: dbUser.email ?? "",
    avatarUrl: null, // TODO: Implement avatar storage
    createdAt: dbUser.createdAt,
    updatedAt: dbUser.updatedAt,
  };
}

export function mapUserToDbModel(entity: Partial<User>): Partial<DbUser> {
  return entity as Partial<DbUser>;
}

export function mapToUserMinimal(dbUser: DbUser): UserMinimal {
  return {
    id: dbUser.id,
    username: dbUser.username ?? "",
    avatarUrl: null, // TODO: Implement avatar storage
  };
}

export class UserRepository {
  constructor(private readonly db: DbClient) {}

  async findById(id: string): Promise<User | null> {
    const result = await this.db.user.findUnique({
      where: { id },
    });
    return result ? mapUserToDomainEntity(result) : null;
  }

  async findBySlug(username: string): Promise<User | null> {
    const result = await this.db.user.findUnique({
      where: { username },
    });
    return result ? mapUserToDomainEntity(result) : null;
  }

  async findMany(options?: QueryOptions<User>): Promise<User[]> {
    const where = options?.filters ? buildWhereClause(options.filters) : {};
    const orderBy = options?.sort ? buildOrderByClause(options.sort) : [{ createdAt: "desc" }];
    const skip =
      options?.pagination?.page && options?.pagination?.limit
        ? (options.pagination.page - 1) * options.pagination.limit
        : undefined;
    const take = options?.pagination?.limit;

    const results = await this.db.user.findMany({
      where,
      orderBy,
      skip,
      take,
    });

    return results.map((result: DbUser) => mapUserToDomainEntity(result));
  }

  async update(id: string, data: Partial<User>): Promise<User | null> {
    try {
      const dbData = mapUserToDbModel(data);
      const result = await this.db.user.update({
        where: { id },
        data: dbData,
      });
      return mapUserToDomainEntity(result);
    } catch (error) {
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.db.user.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async getUserStats(userId?: string): Promise<UserStats[]> {
    const whereClause = userId ? { id: userId } : {};
    
    const users = await this.db.user.findMany({
      where: whereClause,
      include: {
        _count: {
          select: {
            reviews: {
              where: {
                status: "published", // Only count published reviews
              },
            },
            attendances: true, // Attendances are binary, so all are valid
            ratings: {
              where: {
                value: {
                  gte: 1, // Only count ratings >= 1 (valid ratings)
                  lte: 5, // Only count ratings <= 5 (valid ratings)
                },
              },
            },
          },
        },
        ratings: {
          select: {
            value: true,
          },
          where: {
            value: {
              gte: 1,
              lte: 5,
            },
          },
        },
      },
    });

    return users.map((user) => {
      const averageRating = user.ratings.length > 0
        ? user.ratings.reduce((sum, rating) => sum + rating.value, 0) / user.ratings.length
        : null;

      return {
        user: mapUserToDomainEntity(user),
        reviewCount: user._count.reviews,
        attendanceCount: user._count.attendances,
        ratingCount: user._count.ratings,
        averageRating,
      };
    });
  }

  async getTopUsersByMetric(metric: 'reviews' | 'attendance' | 'ratings', limit: number = 10): Promise<UserStats[]> {
    const userStats = await this.getUserStats();
    
    const sortedStats = userStats.sort((a, b) => {
      switch (metric) {
        case 'reviews':
          return b.reviewCount - a.reviewCount;
        case 'attendance':
          return b.attendanceCount - a.attendanceCount;
        case 'ratings':
          return b.ratingCount - a.ratingCount;
        default:
          return 0;
      }
    });

    return sortedStats.slice(0, limit);
  }

  async getCommunityTotals(): Promise<{
    totalUsers: number;
    totalReviews: number;
    totalAttendances: number;
    totalRatings: number;
  }> {
    // Get total counts across all users with same filtering as user stats
    const [totalUsers, totalReviews, totalAttendances, totalRatings] = await Promise.all([
      this.db.user.count(),
      this.db.review.count({
        where: {
          status: "published", // Only count published reviews
        },
      }),
      this.db.attendance.count(),
      this.db.rating.count({
        where: {
          value: {
            gte: 1, // Only count valid ratings
            lte: 5,
          },
        },
      }),
    ]);

    return {
      totalUsers,
      totalReviews,
      totalAttendances,
      totalRatings,
    };
  }
}
