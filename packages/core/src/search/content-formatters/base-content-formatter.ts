export interface ContentFormatter<T = Record<string, unknown>> {
  entityType: string;
  generateDisplayText(entity: T): string;
  generateContent(entity: T): string;
}
