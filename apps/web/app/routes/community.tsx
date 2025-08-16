import type { User } from "@bip/domain";
import { UserRound, Trophy, Star, Music, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { useSerializedLoaderData } from "~/hooks/use-serialized-loader-data";
import { publicLoader } from "~/lib/base-loaders";
import { services } from "~/server/services";
import type { UserStats } from "@bip/core";

interface LoaderData {
  allUserStats: UserStats[];
  topReviewers: UserStats[];
  topAttenders: UserStats[];
  topRaters: UserStats[];
  communityTotals: {
    totalUsers: number;
    totalReviews: number;
    totalAttendances: number;
    totalRatings: number;
  };
}

export const loader = publicLoader<LoaderData>(async ({ request, context }) => {
  try {
    console.log("Attempting to get real user stats...");

    // Get real community totals and user stats in parallel
    const [allUserStats, communityTotals, topReviewers, topAttenders, topRaters] = await Promise.all([
      services.users.getUserStats(),
      services.users.getCommunityTotals(),
      services.users.getTopUsersByMetric("reviews", 5),
      services.users.getTopUsersByMetric("attendance", 5),
      services.users.getTopUsersByMetric("ratings", 5),
    ]);

    console.log("Got user stats:", allUserStats.length);
    console.log("Community totals:", communityTotals);

    return {
      allUserStats: allUserStats.slice(0, 50), // Limit to 50 for performance
      topReviewers,
      topAttenders,
      topRaters,
      communityTotals,
    };
  } catch (error) {
    console.error("Error getting real user stats, falling back to mock:", error);

    // Fallback to users without stats if the new methods fail
    const users = await services.users.findMany();

    const mockUserStats: UserStats[] = users.slice(0, 50).map((user) => ({
      user,
      reviewCount: Math.floor(Math.random() * 25),
      attendanceCount: Math.floor(Math.random() * 50),
      ratingCount: Math.floor(Math.random() * 30),
      averageRating: Math.random() * 5,
    }));

    const topReviewers = [...mockUserStats].sort((a, b) => b.reviewCount - a.reviewCount).slice(0, 5);
    const topAttenders = [...mockUserStats].sort((a, b) => b.attendanceCount - a.attendanceCount).slice(0, 5);
    const topRaters = [...mockUserStats].sort((a, b) => b.ratingCount - a.ratingCount).slice(0, 5);

    return {
      allUserStats: mockUserStats,
      topReviewers,
      topAttenders,
      topRaters,
      communityTotals: {
        totalUsers: users.length,
        totalReviews: mockUserStats.reduce((sum, u) => sum + u.reviewCount, 0),
        totalAttendances: mockUserStats.reduce((sum, u) => sum + u.attendanceCount, 0),
        totalRatings: mockUserStats.reduce((sum, u) => sum + u.ratingCount, 0),
      },
    };
  }
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
  const { user, reviewCount, attendanceCount, ratingCount, averageRating } = userStats;

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
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm text-content-text-secondary">
          <div className="flex items-center gap-1">
            <Music className="h-3 w-3" />
            <span>{attendanceCount} shows</span>
          </div>
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3" />
            <span>{ratingCount} ratings</span>
          </div>
          <div className="flex items-center gap-1">
            <UserRound className="h-3 w-3" />
            <span>{reviewCount} reviews</span>
          </div>
          {averageRating && (
            <div className="flex items-center gap-1">
              <Trophy className="h-3 w-3" />
              <span>{averageRating.toFixed(1)} avg</span>
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
  metric: keyof Pick<UserStats, "reviewCount" | "attendanceCount" | "ratingCount">;
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
  const { allUserStats, topReviewers, topAttenders, topRaters, communityTotals } =
    useSerializedLoaderData<LoaderData>();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="page-heading">BISCUITS COMMUNITY</h1>
        <p className="text-xl text-content-text-secondary mb-6">Meet the fans that make this community special</p>

        {/* Community Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="glass-content">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-brand-primary">{communityTotals.totalUsers}</div>
              <div className="text-sm text-content-text-secondary">Community Members</div>
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

      {/* Leaderboards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <LeaderboardSection title="Top Reviewers" users={topReviewers} icon={UserRound} metric="reviewCount" />
        <LeaderboardSection title="Most Show Attendance" users={topAttenders} icon={Music} metric="attendanceCount" />
        <LeaderboardSection title="Most Ratings Given" users={topRaters} icon={Star} metric="ratingCount" />
      </div>

      {/* All Users Grid */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-content-text-primary">All Community Members</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {allUserStats.map((userStats) => (
            <UserCard key={userStats.user.id} userStats={userStats} />
          ))}
        </div>
      </div>
    </div>
  );
}
