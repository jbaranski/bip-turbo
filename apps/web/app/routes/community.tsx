import type { User } from "@bip/domain";
import { UserRound, Trophy, Star, Music, Calendar, Search, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { useSerializedLoaderData } from "~/hooks/use-serialized-loader-data";
import { publicLoader } from "~/lib/base-loaders";
import { services } from "~/server/services";
import type { UserStats } from "@bip/core";
import { useState } from "react";

interface LoaderData {
  allUserStats: UserStats[];
  topReviewers: UserStats[];
  topAttenders: UserStats[];
  topRaters: UserStats[];
  topBloggers: UserStats[];
  communityTotals: {
    totalUsers: number;
    totalReviews: number;
    totalAttendances: number;
    totalRatings: number;
  };
}

export const loader = publicLoader<LoaderData>(async ({ request, context }) => {
  const cacheKey = "community-page-data";
  
  // Always try to get from cache first
  try {
    const redis = services.redis;
    const cached = await redis.get<LoaderData>(cacheKey);
    if (cached) {
      console.log("Community data served from Redis cache");
      // Debug: Log a sample user to see what we got from cache
      if (cached.allUserStats && cached.allUserStats.length > 0) {
        console.log("Sample cached user stats:", JSON.stringify(cached.allUserStats[0], null, 2));
      }
      return cached;
    }
  } catch (error) {
    console.error("Redis cache read failed for community page:", error);
  }

  // If no cache exists, return minimal fallback data
  // The cron job should populate the cache soon
  console.warn("No community cache found - returning minimal fallback data");
  
  return {
    allUserStats: [],
    topReviewers: [],
    topAttenders: [],
    topRaters: [],
    topBloggers: [],
    communityTotals: {
      totalUsers: 0,
      totalReviews: 0,
      totalAttendances: 0,
      totalRatings: 0,
    },
  };
});

export function meta() {
  return [
    { title: "Community | Biscuits Internet Project" },
    {
      name: "description",
      content: "Meet the Disco Biscuits community - our most active reviewers, show-goers, and contributors.",
    },
  ];
}

function UserCard({ userStats }: { userStats: UserStats }) {
  const { user, reviewCount, attendanceCount, ratingCount, averageRating, communityScore, badges, blogPostCount } = userStats;

  // All scores use consistent brand color
  const getScoreColor = () => "text-brand-primary";

  const topBadge = badges?.[0]; // Show the first (highest) badge

  return (
    <Card className="glass-content hover:glass-content-hover transition-all duration-300">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user.avatarUrl || undefined} />
            <AvatarFallback className="bg-brand-primary/20 text-brand-primary font-medium">
              {user.username?.slice(0, 2).toUpperCase() || "??"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <Link
              to={`/users/${user.username}`}
              className="text-brand-primary hover:text-brand-secondary font-medium transition-colors"
            >
              {user.username}
            </Link>
            {topBadge && (
              <div className="text-xs text-content-text-secondary mt-1">
                {topBadge.emoji} {topBadge.name}
              </div>
            )}
          </div>
          <div className="text-right">
            <Badge variant="default" className="bg-brand-primary text-white font-bold text-sm px-3 py-1">
              {communityScore || 0}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm text-content-text-secondary">
          <div className="flex items-center gap-1">
            <UserRound className="h-3 w-3" />
            <span>{reviewCount} reviews</span>
          </div>
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3" />
            <span>{ratingCount} ratings</span>
          </div>
          <div className="flex items-center gap-1">
            <Music className="h-3 w-3" />
            <span>{attendanceCount} shows</span>
          </div>
          <div className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            <span>{blogPostCount} posts</span>
          </div>
          {averageRating && (
            <div className="flex items-center gap-1 col-span-2">
              <Trophy className="h-3 w-3" />
              <span>{averageRating.toFixed(1)} avg rating</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LeaderboardSection({
  title,
  users,
  icon: Icon,
  metric,
}: {
  title: string;
  users: UserStats[];
  icon: React.ComponentType<{ className?: string }>;
  metric: keyof Pick<UserStats, "reviewCount" | "attendanceCount" | "ratingCount" | "blogPostCount">;
}) {
  return (
    <Card className="card-premium">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Icon className="h-5 w-5 text-brand-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {users.map((userStats, index) => (
            <div key={userStats.user.id} className="flex items-center gap-3">
              <div className="flex-shrink-0 w-8 text-center">
                <Badge
                  variant={index === 0 ? "default" : "secondary"}
                  className={index === 0 ? "bg-rating-gold text-black" : ""}
                >
                  {index + 1}
                </Badge>
              </div>
              <Avatar className="h-8 w-8">
                <AvatarImage src={userStats.user.avatarUrl || undefined} />
                <AvatarFallback className="bg-brand-primary/20 text-brand-primary text-xs">
                  {userStats.user.username?.slice(0, 2).toUpperCase() || "??"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <Link
                  to={`/users/${userStats.user.username}`}
                  className="text-content-text-primary hover:text-brand-primary font-medium transition-colors"
                >
                  {userStats.user.username}
                </Link>
              </div>
              <div className="text-brand-primary font-medium">{userStats[metric]}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Community() {
  const { allUserStats, topReviewers, topAttenders, topRaters, topBloggers, communityTotals } =
    useSerializedLoaderData<LoaderData>();

  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("score");

  // Filter users by search term
  const filteredUsers = allUserStats.filter(userStat => 
    userStat.user.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sort filtered users
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    switch (sortBy) {
      case "score":
        return (b.communityScore || 0) - (a.communityScore || 0);
      case "reviews":
        return b.reviewCount - a.reviewCount;
      case "ratings":
        return b.ratingCount - a.ratingCount;
      case "attendance":
        return b.attendanceCount - a.attendanceCount;
      case "blogPosts":
        return b.blogPostCount - a.blogPostCount;
      case "username":
        return (a.user.username || "").localeCompare(b.user.username || "");
      default:
        return (b.communityScore || 0) - (a.communityScore || 0);
    }
  });

  // Sort by community score for top scores leaderboard
  const topCommunityScores = [...allUserStats]
    .sort((a, b) => (b.communityScore || 0) - (a.communityScore || 0))
    .slice(0, 5);

  const averageScore = allUserStats.length > 0 
    ? Math.round(allUserStats.reduce((sum, u) => sum + (u.communityScore || 0), 0) / allUserStats.length)
    : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="page-heading">BISCUITS COMMUNITY</h1>
        <p className="text-xl text-content-text-secondary mb-6">Community scores, badges, and leaderboards</p>

        {/* Community Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="glass-content">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-brand-primary">{communityTotals.totalUsers}</div>
              <div className="text-sm text-content-text-secondary">Community Members</div>
            </CardContent>
          </Card>
          <Card className="glass-content">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-green-500">{averageScore}</div>
              <div className="text-sm text-content-text-secondary">Average Score</div>
            </CardContent>
          </Card>
          <Card className="glass-content">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-brand-secondary">{communityTotals.totalReviews}</div>
              <div className="text-sm text-content-text-secondary">Total Reviews</div>
            </CardContent>
          </Card>
          <Card className="glass-content">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-brand-tertiary">{communityTotals.totalAttendances}</div>
              <div className="text-sm text-content-text-secondary">Shows Attended</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Top Community Scores */}
      <div className="mb-8">
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Trophy className="h-5 w-5 text-brand-primary" />
              Top Community Scores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topCommunityScores.map((userStats, index) => (
                <div key={userStats.user.id} className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 text-center">
                    <Badge
                      variant={index === 0 ? "default" : "secondary"}
                      className={index === 0 ? "bg-rating-gold text-black" : ""}
                    >
                      {index + 1}
                    </Badge>
                  </div>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={userStats.user.avatarUrl || undefined} />
                    <AvatarFallback className="bg-brand-primary/20 text-brand-primary text-xs">
                      {userStats.user.username?.slice(0, 2).toUpperCase() || "??"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <Link
                      to={`/users/${userStats.user.username}`}
                      className="text-content-text-primary hover:text-brand-primary font-medium transition-colors"
                    >
                      {userStats.user.username}
                    </Link>
                    {userStats.badges?.[0] && (
                      <div className="text-xs text-content-text-secondary">
                        {userStats.badges[0].emoji} {userStats.badges[0].name}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <Badge variant="default" className="bg-brand-primary text-white font-bold text-sm px-3 py-1">
                      {userStats.communityScore || 0}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Leaderboards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-8">
        <LeaderboardSection title="Top Reviewers" users={topReviewers} icon={UserRound} metric="reviewCount" />
        <LeaderboardSection title="Most Show Attendance" users={topAttenders} icon={Music} metric="attendanceCount" />
        <LeaderboardSection title="Most Ratings Given" users={topRaters} icon={Star} metric="ratingCount" />
        <LeaderboardSection title="Top Bloggers" users={topBloggers} icon={FileText} metric="blogPostCount" />
      </div>

      {/* All Users Grid */}
      <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h2 className="text-2xl font-bold text-content-text-primary">All Community Members</h2>
          
          {/* Search and Sort Controls */}
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-content-text-secondary h-4 w-4" />
              <Input
                placeholder="Search usernames..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full sm:w-64"
              />
            </div>
            
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score">Score (Highest)</SelectItem>
                <SelectItem value="reviews">Reviews (Most)</SelectItem>
                <SelectItem value="ratings">Ratings (Most)</SelectItem>
                <SelectItem value="attendance">Shows (Most)</SelectItem>
                <SelectItem value="blogPosts">Blog Posts (Most)</SelectItem>
                <SelectItem value="username">Username (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="text-sm text-content-text-secondary mb-4">
          Showing {sortedUsers.length} of {allUserStats.length} community members
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedUsers.map((userStats) => (
            <UserCard key={userStats.user.id} userStats={userStats} />
          ))}
        </div>
      </div>
    </div>
  );
}
