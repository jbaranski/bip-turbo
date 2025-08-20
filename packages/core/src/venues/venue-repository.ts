import type { Venue } from "@bip/domain";
import type { DbClient, DbVenue } from "../_shared/database/models";
import { buildOrderByClause, buildWhereClause } from "../_shared/database/query-utils";
import type { QueryOptions } from "../_shared/database/types";
import { slugify } from "../_shared/utils/slugify";

export function mapVenueToDomainEntity(dbVenue: DbVenue): Venue {
  const { slug, createdAt, updatedAt, name, ...rest } = dbVenue;

  return {
    ...rest,
    slug: slug || "",
    createdAt: new Date(createdAt),
    updatedAt: new Date(updatedAt),
    name: name || "",
  };
}

export function mapVenueToDbModel(entity: Partial<Venue>): Partial<DbVenue> {
  return entity as Partial<DbVenue>;
}

export class VenueRepository {
  constructor(private readonly db: DbClient) {}

  protected mapToDomainEntity(dbVenue: DbVenue): Venue {
    return mapVenueToDomainEntity(dbVenue);
  }

  protected mapToDbModel(entity: Partial<Venue>): Partial<DbVenue> {
    return mapVenueToDbModel(entity);
  }

  private async generateVenueSlug(name: string, city?: string | null, state?: string | null, excludeId?: string): Promise<string> {
    let baseSlug = slugify(name);
    
    // Check if slug already exists (excluding current venue if updating)
    const existing = await this.db.venue.findFirst({
      where: { 
        slug: baseSlug,
        ...(excludeId && { id: { not: excludeId } })
      }
    });
    
    // If duplicate, add city and state
    if (existing) {
      const parts = [name, city, state].filter(Boolean).join("-");
      baseSlug = slugify(parts);
    }
    
    return baseSlug;
  }

  async findById(id: string): Promise<Venue | null> {
    const result = await this.db.venue.findUnique({
      where: { id },
    });
    return result ? this.mapToDomainEntity(result) : null;
  }

  async findBySlug(slug: string): Promise<Venue | null> {
    const result = await this.db.venue.findFirst({
      where: { slug },
    });
    return result ? this.mapToDomainEntity(result) : null;
  }

  async findMany(options?: QueryOptions<Venue>): Promise<Venue[]> {
    const where = options?.filters ? buildWhereClause(options.filters) : {};
    const orderBy = options?.sort ? buildOrderByClause(options.sort) : [{ timesPlayed: "desc" }];
    const skip =
      options?.pagination?.page && options?.pagination?.limit
        ? (options.pagination.page - 1) * options.pagination.limit
        : undefined;
    const take = options?.pagination?.limit;

    const results = await this.db.venue.findMany({
      where,
      orderBy,
      skip,
      take,
    });

    return results.map((result: DbVenue) => this.mapToDomainEntity(result));
  }

  async create(data: Omit<Venue, "id" | "slug" | "createdAt" | "updatedAt" | "timesPlayed">): Promise<Venue> {
    const slug = await this.generateVenueSlug(data.name, data.city, data.state);
    const result = await this.db.venue.create({
      data: {
        ...data,
        slug,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    return this.mapToDomainEntity(result);
  }

  async update(id: string, data: Partial<Venue>): Promise<Venue> {
    const updateData: any = {
      ...this.mapToDbModel(data),
      updatedAt: new Date(),
    };
    
    // Regenerate slug if name, city, or state changes
    if (data.name || data.city || data.state) {
      // Get current venue for fallback values
      const current = await this.db.venue.findUnique({
        where: { id },
        select: { name: true, city: true, state: true }
      });
      
      if (current) {
        const name = data.name || current.name || "";
        const city = data.city || current.city;
        const state = data.state || current.state;
        updateData.slug = await this.generateVenueSlug(name, city, state, id);
      }
    }
    
    const result = await this.db.venue.update({
      where: { id },
      data: updateData,
    });
    return this.mapToDomainEntity(result);
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.db.venue.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}
