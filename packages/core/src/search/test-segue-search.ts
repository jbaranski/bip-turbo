#!/usr/bin/env bun

import { PrismaClient } from "@prisma/client";
import { PostgresSearchService } from "./postgres-search-service";
import { testLogger as logger } from "../_shared/test-logger";

async function main() {
  const db = new PrismaClient();
  const searchService = new PostgresSearchService(db, logger);

  const testQueries = [
    "i-man > freeze",
    "little shimmy > basis",
    "hot air balloon > above the waves",
    "new york i-man > freeze"
  ];

  for (const query of testQueries) {
    console.log(`\n🔍 Testing search: "${query}"`);
    console.log("=" .repeat(50));
    
    try {
      const results = await searchService.search(query, { limit: 5 });
      
      if (results.length === 0) {
        console.log("No results found");
      } else {
        console.log(`Found ${results.length} results:\n`);
        
        for (const result of results) {
          console.log(`📅 ${result.displayText || 'Unknown Show'}`);
          console.log(`   Score: ${result.score}%`);
          
          if (result.metadata?.matchDetails) {
            try {
              const details = JSON.parse(result.metadata.matchDetails);
              if (details.type === 'segueMatch' && details.segueRun) {
                console.log(`   🎵 Segue: ${details.segueRun.sequence}`);
                console.log(`   📍 Set: ${details.segueRun.set}, Length: ${details.segueRun.length} songs`);
              }
            } catch (_e) {
              console.log(`   Match details: ${result.metadata.matchDetails}`);
            }
          }
          console.log();
        }
      }
    } catch (error) {
      console.error("Search error:", error);
    }
  }

  await db.$disconnect();
}

main();