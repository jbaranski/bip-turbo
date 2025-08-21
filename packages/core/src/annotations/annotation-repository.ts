import type { Annotation } from "@bip/domain";
import type { DbAnnotation, DbClient } from "../_shared/database/models";

export function mapAnnotationToDomainEntity(dbAnnotation: DbAnnotation): Annotation {
  const { createdAt, updatedAt, ...rest } = dbAnnotation;

  return {
    ...rest,
    createdAt: new Date(createdAt),
    updatedAt: new Date(updatedAt),
  };
}

export function mapAnnotationToDbModel(entity: Partial<Annotation>): Partial<DbAnnotation> {
  return entity as Partial<DbAnnotation>;
}

export class AnnotationRepository {
  constructor(private readonly db: DbClient) {}

  protected mapToDomainEntity(dbAnnotation: DbAnnotation): Annotation {
    return mapAnnotationToDomainEntity(dbAnnotation);
  }

  protected mapToDbModel(entity: Partial<Annotation>): Partial<DbAnnotation> {
    return mapAnnotationToDbModel(entity);
  }

  async findById(id: string): Promise<Annotation | null> {
    const result = await this.db.annotation.findUnique({
      where: { id },
    });
    return result ? this.mapToDomainEntity(result) : null;
  }

  async findByTrackId(trackId: string): Promise<Annotation[]> {
    const results = await this.db.annotation.findMany({
      where: { trackId },
      orderBy: { createdAt: "desc" },
    });
    return results.map((result) => this.mapToDomainEntity(result));
  }

  async create(data: Partial<Annotation>): Promise<Annotation> {
    const now = new Date();
    const createData = {
      trackId: data.trackId!,
      desc: data.desc || null,
      createdAt: now,
      updatedAt: now,
    };
    console.log('Creating annotation with data:', createData);
    const result = await this.db.annotation.create({
      data: createData,
    });
    return this.mapToDomainEntity(result);
  }

  async update(id: string, data: Partial<Annotation>): Promise<Annotation> {
    const result = await this.db.annotation.update({
      where: { id },
      data: {
        ...(data.desc !== undefined && { desc: data.desc }),
        updatedAt: new Date(),
      },
    });
    return this.mapToDomainEntity(result);
  }

  async delete(id: string): Promise<boolean> {
    await this.db.annotation.delete({
      where: { id },
    });
    return true;
  }

  async deleteByTrackId(trackId: string): Promise<boolean> {
    await this.db.annotation.deleteMany({
      where: { trackId },
    });
    return true;
  }
}