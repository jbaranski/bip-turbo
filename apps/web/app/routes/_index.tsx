import type { Attendance, BlogPostWithUser, Rating, Setlist, TourDate } from "@bip/domain";
import { ArrowRight, Calendar, FileText, MapPin, Music, Search } from "lucide-react";
import { Link, redirect } from "react-router-dom";
import { BlogCard } from "~/components/blog/blog-card";
import { SetlistCard } from "~/components/setlist/setlist-card";
import { Card } from "~/components/ui/card";
import { useSerializedLoaderData } from "~/hooks/use-serialized-loader-data";
import { publicLoader } from "~/lib/base-loaders";
import { services } from "~/server/services";

interface AcastEpisode {
  id: string;
  title: string;
  description: string;
  publishDate: string;
  duration: number;
  mediaUrl: string;
  image: string;
  url: string;
}

interface LoaderData {
  tourDates: TourDate[];
  recentShows: Setlist[];
  recentBlogPosts: Array<BlogPostWithUser>;
  attendancesByShowId: Record<string, Attendance>;
  ratingsByShowId: Record<string, Rating>;
  latestEpisode: AcastEpisode | null;
  nextTourDate: TourDate | null;
  todaysSetlist: Setlist | null;
  yesterdaysSetlist: Setlist | null;
}

export const loader = publicLoader<LoaderData>(async ({ request, context }) => {
  const { currentUser } = context;

  const allTourDates = Array.isArray(await services.tourDatesService.getTourDates())
    ? await services.tourDatesService.getTourDates()
    : [];

  // Find next tour date (first upcoming show)
  const now = new Date();
  const nextTourDate = allTourDates.find((date) => new Date(date.date) >= now) || null;

  // Find today's or yesterday's show
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const todaysShow = allTourDates.find((date) => {
    const showDate = new Date(date.date);
    showDate.setHours(0, 0, 0, 0);
    return showDate.getTime() === today.getTime();
  });

  const yesterdaysShow = allTourDates.find((date) => {
    const showDate = new Date(date.date);
    showDate.setHours(0, 0, 0, 0);
    return showDate.getTime() === yesterday.getTime();
  });

  // Find setlists for today's or yesterday's show from recent setlists (last 2 days)
  let todaysSetlist: Setlist | null = null;
  let yesterdaysSetlist: Setlist | null = null;

  if (todaysShow || yesterdaysShow) {
    // Get recent setlists from last few days
    const recentSetlists = await services.setlists.findMany({
      pagination: { limit: 5 }, // Just get last few shows
      sort: [{ field: "date", direction: "desc" }],
    });

    for (const setlist of recentSetlists) {
      const setlistDate = new Date(setlist.show.date);
      setlistDate.setHours(0, 0, 0, 0);

      if (todaysShow && setlistDate.getTime() === today.getTime()) {
        todaysSetlist = setlist;
      } else if (yesterdaysShow && setlistDate.getTime() === yesterday.getTime()) {
        yesterdaysSetlist = setlist;
      }
    }
  }

  // Limit to next 8 upcoming dates for home page
  const tourDates = allTourDates.slice(0, 8);

  // Get recent shows optimized for mobile - filter shows that are more than 1 day in future
  const allRecentShows = await services.setlists.findMany({
    pagination: { limit: 10 }, // Get more to filter from
    sort: [{ field: "date", direction: "desc" }],
  });

  // Filter shows: only show past shows or shows within 1 day in the future
  const oneDayFromNow = new Date();
  oneDayFromNow.setDate(oneDayFromNow.getDate() + 1);

  const recentShows = allRecentShows
    .filter((setlist) => {
      const showDate = new Date(setlist.show.date);
      return showDate <= oneDayFromNow;
    })
    .slice(0, 2); // Take only the last 2 shows after filtering

  // Get recent blog posts (last 5)
  const recentBlogPosts = await services.blogPosts.findManyWithUser({
    pagination: { limit: 5 },
    sort: [{ field: "createdAt", direction: "desc" }],
    filters: [
      { field: "state", operator: "eq", value: "published" },
      { field: "publishedAt", operator: "lte", value: new Date() },
    ],
  });

  const attendances = currentUser
    ? await services.attendances.findManyByUserIdAndShowIds(
        currentUser.id,
        recentShows.map((s) => s.show.id),
      )
    : [];
  const ratings = currentUser
    ? await services.ratings.findManyByUserIdAndRateableIds(
        currentUser.id,
        recentShows.map((s) => s.show.id),
        "Show",
      )
    : [];
  const attendancesByShowId = attendances.reduce(
    (acc, attendance) => {
      acc[attendance.showId] = attendance;
      return acc;
    },
    {} as Record<string, Attendance>,
  );
  const ratingsByShowId = ratings.reduce(
    (acc, rating) => {
      acc[rating.rateableId] = rating;
      return acc;
    },
    {} as Record<string, Rating>,
  );

  // Fetch latest podcast episode
  let latestEpisode: AcastEpisode | null = null;
  try {
    const response = await fetch(
      "https://feeder.acast.com/api/v1/shows/d690923d-524e-5c8b-b29f-d66517615b5b?limit=1&from=0",
    );
    const data = await response.json();
    latestEpisode = data.episodes?.[0] || null;
  } catch (error) {
    console.error("Error fetching latest episode:", error);
  }

  return {
    tourDates,
    recentShows,
    recentBlogPosts,
    attendancesByShowId,
    ratingsByShowId,
    latestEpisode,
    nextTourDate,
    todaysSetlist,
    yesterdaysSetlist,
  };
});

export function meta() {
  return [
    { title: "Biscuits Internet Project" },
    {
      name: "description",
      content: "The ultimate resource for Disco Biscuits fans - shows, setlists, songs, venues, and more.",
    },
  ];
}

export default function Index() {
  const {
    tourDates = [],
    recentShows = [],
    recentBlogPosts = [],
    attendancesByShowId = {} as Record<string, Attendance>,
    ratingsByShowId = {} as Record<string, Rating>,
    latestEpisode,
    nextTourDate,
    todaysSetlist,
    yesterdaysSetlist,
  } = useSerializedLoaderData<LoaderData>();

  return (
    <div className="w-full p-0">
      {/* Hero section - Compact */}
      <div className="pt-0 pb-3 text-center mb-4">
        <h1 className="text-3xl md:text-5xl font-bold font-tron-audiowide tron-outline-brand text-black">
          BISCUITS INTERNET PROJECT 3.0
        </h1>
      </div>

      {/* Today's or Yesterday's Show - Full Setlist Card */}
      {(todaysSetlist || yesterdaysSetlist) && (
        <div className="mb-6">
          <div className="mb-2">
            <h2 className="text-xl font-bold">{todaysSetlist ? "Tonight's Show" : "Yesterday's Show"}</h2>
          </div>
          <SetlistCard
            setlist={todaysSetlist || yesterdaysSetlist!}
            userAttendance={attendancesByShowId[(todaysSetlist || yesterdaysSetlist)!.show.id] || null}
            userRating={ratingsByShowId[(todaysSetlist || yesterdaysSetlist)!.show.id] || null}
            showRating={(todaysSetlist || yesterdaysSetlist)!.show.averageRating}
          />
        </div>
      )}

      {/* Next Show Banner - Compact */}
      {nextTourDate && (
        <div className="mb-6">
          <Card className="card-premium">
            <div className="p-4 text-center">
              <div className="flex items-center justify-center mb-1">
                <Calendar className="h-4 w-4 mr-2 text-brand-primary" />
                <h3 className="text-sm font-semibold text-brand-primary">Next Show</h3>
              </div>
              <div className="text-lg font-bold text-content-text-primary">{nextTourDate.formattedStartDate}</div>
              <div className="text-sm text-content-text-secondary">
                {nextTourDate.venueName} • {nextTourDate.address}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Mobile-Optimized Content Layout */}
      <div className="space-y-8">
        {/* Latest Podcast Episode - Compact */}
        {latestEpisode && (
          <div>
            <div className="mb-4">
              <h2 className="text-xl font-bold">Touchdowns All Day Podcast</h2>
              <Link
                to="/resources/touchdowns"
                className="text-sm text-content-text-tertiary hover:text-brand-primary transition-colors"
              >
                View all episodes →
              </Link>
            </div>

            <div className="card-premium rounded-lg overflow-hidden">
              {latestEpisode.image && (
                <div className="relative">
                  <img src={latestEpisode.image} alt={latestEpisode.title} className="w-full h-32 object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-2 left-3 right-3">
                    <h3 className="text-white text-sm font-semibold line-clamp-2">{latestEpisode.title}</h3>
                  </div>
                </div>
              )}

              <div className="p-4">
                <div
                  className="text-content-text-secondary text-sm mb-3 line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: latestEpisode.description }}
                />

                <div className="flex justify-between items-center">
                  <div className="text-content-text-tertiary text-xs">
                    {Math.floor(latestEpisode.duration / 60)} min •{" "}
                    {latestEpisode.publishDate
                      ? new Date(latestEpisode.publishDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      : ""}
                  </div>
                  <a
                    href={latestEpisode.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-primary hover:text-brand-secondary text-xs font-medium hover:underline transition-colors"
                  >
                    Listen →
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Shows Section - Optimized for Last 2 Shows */}
        <div>
          <div className="mb-6">
            <h2 className="text-xl font-bold">Recent Shows</h2>
            <Link to="/shows" className="text-sm text-content-text-tertiary hover:text-brand-primary transition-colors">
              View all shows →
            </Link>
          </div>

          {recentShows.length > 0 ? (
            <div className="grid gap-6">
              {recentShows.map((setlist) => (
                <SetlistCard
                  key={setlist.show.id}
                  setlist={setlist}
                  userAttendance={attendancesByShowId[setlist.show.id] || null}
                  userRating={ratingsByShowId[setlist.show.id] || null}
                  showRating={setlist.show.averageRating}
                />
              ))}
            </div>
          ) : (
            <div className="text-center p-8 border border-dashed rounded-lg">
              <p className="text-muted-foreground">No recent shows available</p>
            </div>
          )}
        </div>

        {/* Upcoming Tour Dates Section */}
        <div>
          <div className="mb-6">
            <h2 className="text-xl font-bold">Upcoming Tour Dates</h2>
            <Link
              to="/shows/tour-dates"
              className="text-sm text-content-text-tertiary hover:text-brand-primary transition-colors"
            >
              View all tour dates →
            </Link>
          </div>

          {tourDates.length > 0 ? (
            <Card className="card-premium">
              <div className="relative overflow-x-auto">
                <table className="w-full text-md">
                  <thead>
                    <tr className="text-left text-sm text-content-text-secondary border-b border-glass-border/40">
                      <th className="p-4">Date</th>
                      <th className="p-4">Venue</th>
                      <th className="hidden md:table-cell p-4">Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tourDates.map((td: TourDate) => (
                      <tr
                        key={td.formattedStartDate + td.venueName}
                        className="border-b border-glass-border/40 hover:bg-hover-glass"
                      >
                        <td className="p-4 text-content-text-primary">
                          {td.formattedStartDate === td.formattedEndDate
                            ? td.formattedStartDate
                            : `${td.formattedStartDate} - ${td.formattedEndDate}`}
                        </td>
                        <td className="p-4 text-brand-primary font-medium">{td.venueName}</td>
                        <td className="hidden md:table-cell p-4 text-content-text-secondary">{td.address}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <div className="text-center p-8 border border-dashed rounded-lg">
              <p className="text-muted-foreground">No upcoming tour dates available</p>
            </div>
          )}
        </div>

        {/* Recent Blog Posts Section */}
        <div>
          <div className="mb-6">
            <h2 className="text-xl font-bold">Latest from the Blog</h2>
            <Link to="/blog" className="text-sm text-content-text-tertiary hover:text-brand-primary transition-colors">
              View all blog posts →
            </Link>
          </div>

          {recentBlogPosts.length > 0 ? (
            <div className="grid gap-4">
              {recentBlogPosts.map((blogPost) => (
                <BlogCard key={blogPost.id} blogPost={blogPost} compact={true} />
              ))}
            </div>
          ) : (
            <div className="text-center p-8 border border-dashed rounded-lg">
              <p className="text-muted-foreground">No blog posts available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
