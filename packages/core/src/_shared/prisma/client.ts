import { PrismaClient } from "@prisma/client";

// Prevent multiple instances of Prisma Client in development
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Create a singleton instance of the Prisma client with connection pooling for long-lived server
export const prisma =
  global.__prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    datasources: {
      db: {
        url: addConnectionPoolParams(process.env.DATABASE_URL || ""),
      },
    },
  });

// Add connection pool parameters for Supabase free tier (long-lived server)
function addConnectionPoolParams(url: string): string {
  if (!url) return url;
  
  const dbUrl = new URL(url);
  
  // Conservative settings for Supabase free tier
  dbUrl.searchParams.set("connection_limit", "5");
  dbUrl.searchParams.set("pool_timeout", "20");
  
  return dbUrl.toString();
}

// In development, attach the client to the global object to prevent multiple instances
if (process.env.NODE_ENV === "development") {
  global.__prisma = prisma;
}

export default prisma;
