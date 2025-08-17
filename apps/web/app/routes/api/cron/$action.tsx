import type { ActionFunctionArgs } from "react-router";
import { json } from "react-router";
import { services } from "~/server/services";

interface CronJobResult {
  success: boolean;
  message: string;
  duration?: number;
  timestamp: string;
}

async function refreshCommunityCache(): Promise<CronJobResult> {
  const startTime = Date.now();
  
  try {
    console.log("Starting community cache refresh...");
    
    // Clear existing cache
    const redis = services.redis;
    await redis.del("community-page-data");
    
    // Fetch fresh data (same logic as community route loader)
    const [allUserStats, communityTotals, topReviewers, topAttenders, topRaters] = await Promise.all([
      services.users.getUserStats(),
      services.users.getCommunityTotals(),
      services.users.getTopUsersByMetric("reviews", 5),
      services.users.getTopUsersByMetric("attendance", 5),
      services.users.getTopUsersByMetric("ratings", 5),
    ]);

    const result = {
      allUserStats: allUserStats.slice(0, 50),
      topReviewers,
      topAttenders,
      topRaters,
      communityTotals,
    };

    // Cache the fresh data (no expiration - refreshed by cron)
    await redis.set("community-page-data", result);
    
    const duration = Date.now() - startTime;
    console.log(`Community cache refreshed successfully in ${duration}ms`);
    
    return {
      success: true,
      message: `Community cache refreshed successfully. Cached ${allUserStats.length} user stats.`,
      duration,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("Failed to refresh community cache:", error);
    
    return {
      success: false,
      message: `Failed to refresh community cache: ${error instanceof Error ? error.message : "Unknown error"}`,
      duration,
      timestamp: new Date().toISOString(),
    };
  }
}

// Map of available cron jobs
const cronJobs: Record<string, () => Promise<CronJobResult>> = {
  "community-refresh": refreshCommunityCache,
};

export async function action({ params, request }: ActionFunctionArgs) {
  const { action } = params;
  
  if (!action) {
    return json({ error: "Action parameter is required" }, { status: 400 });
  }

  // Simple security check - require specific user agent from GitHub Actions
  const userAgent = request.headers.get("user-agent") || "";
  const isGitHubActions = userAgent.includes("curl") || userAgent.includes("GitHub-Actions");
  
  if (!isGitHubActions) {
    console.warn(`Unauthorized cron access attempt from: ${userAgent}`);
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const cronJob = cronJobs[action];
  if (!cronJob) {
    return json(
      { error: `Unknown cron action: ${action}. Available actions: ${Object.keys(cronJobs).join(", ")}` },
      { status: 404 }
    );
  }

  try {
    console.log(`🤖 Executing cron job: ${action}`);
    const result = await cronJob();
    
    return json({
      action,
      ...result,
    });
  } catch (error) {
    console.error(`Cron job ${action} failed:`, error);
    
    return json({
      action,
      success: false,
      message: `Cron job failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}