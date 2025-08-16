import type { LoaderFunctionArgs, MetaFunction } from "react-router-dom";
import { useLoaderData } from "react-router-dom";
import { CalendarDays, Edit, MessageSquare, Star, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Button } from "~/components/ui/button";
import { SetlistCard } from "~/components/setlist/setlist-card";
import { services } from "~/server/services";
import { formatDateLong } from "~/lib/utils";
import { getServerClient } from "~/server/supabase";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data?.user) {
    return [
      { title: "User Not Found | Biscuits Internet Project" },
      { name: "description", content: "The requested user profile could not be found." },
    ];
  }

  return [
    { title: `${data.user.username} | Biscuits Internet Project` },
    { name: "description", content: `View ${data.user.username}'s profile, reviews, and show attendance.` },
  ];
};

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { username } = params;
  if (!username) {
    throw new Response("Username not provided", { status: 400 });
  }

  // Get current session user
  const { supabase } = getServerClient(request);
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const sessionUser = session?.user
    ? {
        id: session.user.id,
        role: session.user.user_metadata?.role,
      }
    : null;

  // Find the user by username
  const user = await services.users.findByUsername(username);
  if (!user) {
    throw new Response("User not found", { status: 404 });
  }

  // Get user's reviews with show data
  const reviews = await services.reviews.findByUserIdWithShow(user.id, {
    sort: [{ field: "createdAt", direction: "desc" }],
  });

  // Get user's blog posts (simplified - we'll enhance this later)
  const blogPosts: any[] = []; // TODO: Implement blog post retrieval

  // Get user's attendances with show data
  const userAttendances = await services.attendances.findByUserIdWithShow(user.id, {
    sort: [{ field: "createdAt", direction: "desc" }],
  });

  // Get user's ratings with show and track data
  const [showRatings, trackRatings] = await Promise.all([
    services.ratings.findShowRatingsByUserId(user.id),
    services.ratings.findTrackRatingsByUserId(user.id),
  ]);

  const attendanceCount = userAttendances.length;
  const reviewCount = reviews.length;
  const showRatingsCount = showRatings.length;
  const trackRatingsCount = trackRatings.length;

  return {
    user,
    reviews,
    blogPosts,
    userAttendances,
    showRatings,
    trackRatings,
    attendanceCount,
    reviewCount,
    showRatingsCount,
    trackRatingsCount,
    isOwnProfile: sessionUser?.id === user.id,
  };
}

export default function UserProfile() {
  const {
    user,
    reviews,
    blogPosts,
    userAttendances,
    showRatings,
    trackRatings,
    attendanceCount,
    reviewCount,
    showRatingsCount,
    trackRatingsCount,
    isOwnProfile,
  } = useLoaderData<typeof loader>();

  return (
    <div className="w-full space-y-6">
      {/* Profile Header */}
      <Card className="card-premium">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-6">
              {/* Avatar */}
              <div className="w-24 h-24 rounded-full overflow-hidden bg-glass-bg border-2 border-glass-border flex items-center justify-center flex-shrink-0">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={`${user.username}'s avatar`} className="w-full h-full object-cover" />
                ) : (
                  <Users className="w-10 h-10 text-content-text-tertiary" />
                )}
              </div>

              {/* User Info */}
              <div className="space-y-3">
                <div>
                  <h1 className="text-3xl font-bold text-content-text-primary">{user.username}</h1>
                  <p className="text-content-text-secondary">
                    Member since {formatDateLong(user.createdAt.toISOString())}
                  </p>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-brand-tertiary" />
                    <span className="text-content-text-secondary">
                      <span className="font-medium text-content-text-primary">{attendanceCount}</span> shows attended
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-brand-primary" />
                    <span className="text-content-text-secondary">
                      <span className="font-medium text-content-text-primary">{reviewCount}</span> reviews written
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Edit className="w-4 h-4 text-brand-secondary" />
                    <span className="text-content-text-secondary">
                      <span className="font-medium text-content-text-primary">{blogPosts.length}</span> blog posts
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Edit Profile Button */}
            {isOwnProfile && (
              <Button asChild className="btn-secondary">
                <Link to="/profile/edit">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Profile
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Content Tabs */}
      <Tabs defaultValue="reviews" className="w-full">
        <TabsList className="glass mb-6">
          <TabsTrigger value="reviews" className="data-[state=active]:bg-brand-primary data-[state=active]:text-white">
            Reviews ({reviewCount})
          </TabsTrigger>
          <TabsTrigger
            value="show-ratings"
            className="data-[state=active]:bg-brand-primary data-[state=active]:text-white"
          >
            Show Ratings ({showRatingsCount})
          </TabsTrigger>
          <TabsTrigger
            value="track-ratings"
            className="data-[state=active]:bg-brand-primary data-[state=active]:text-white"
          >
            Song Version Ratings ({trackRatingsCount})
          </TabsTrigger>
          <TabsTrigger value="shows" className="data-[state=active]:bg-brand-primary data-[state=active]:text-white">
            Shows Attended ({attendanceCount})
          </TabsTrigger>
          {blogPosts.length > 0 && (
            <TabsTrigger value="blog" className="data-[state=active]:bg-brand-primary data-[state=active]:text-white">
              Blog Posts ({blogPosts.length})
            </TabsTrigger>
          )}
        </TabsList>

        {/* Reviews Tab */}
        <TabsContent value="reviews" className="space-y-4">
          {reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map((review) => (
                <Card key={review.id} className="card-premium">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {review.show ? (
                          <Link
                            to={`/shows/${review.show.slug}`}
                            className="text-brand-primary hover:text-brand-secondary transition-colors hover:underline"
                          >
                            {review.show.venue.name}
                          </Link>
                        ) : (
                          <span className="text-brand-primary">Show Review</span>
                        )}
                      </CardTitle>
                      <span className="text-sm text-content-text-tertiary">
                        {formatDateLong(review.createdAt.toISOString())}
                      </span>
                    </div>
                    {review.show && (
                      <div className="flex items-center gap-2 text-sm text-content-text-secondary mt-1">
                        <CalendarDays className="w-4 h-4" />
                        <span>{formatDateLong(review.show.date)}</span>
                        {review.show.venue.city && review.show.venue.state && (
                          <span>
                            • {review.show.venue.city}, {review.show.venue.state}
                          </span>
                        )}
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-invert max-w-none">
                      <p className="text-content-text-secondary whitespace-pre-wrap">{review.content}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="card-premium">
              <CardContent className="py-12 text-center">
                <MessageSquare className="w-12 h-12 text-content-text-tertiary mx-auto mb-4" />
                <h3 className="text-lg font-medium text-content-text-primary mb-2">No Reviews Yet</h3>
                <p className="text-content-text-secondary">
                  {isOwnProfile
                    ? "You haven't written any reviews yet. Check out some shows and share your thoughts!"
                    : `${user.username} hasn't written any reviews yet.`}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Show Ratings Tab */}
        <TabsContent value="show-ratings" className="space-y-4">
          {showRatings.length > 0 ? (
            <div className="space-y-4">
              {showRatings.map((rating) => (
                <Card key={rating.id} className="card-premium">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {rating.show.slug ? (
                          <Link
                            to={`/shows/${rating.show.slug}`}
                            className="text-brand-primary hover:text-brand-secondary transition-colors hover:underline"
                          >
                            {rating.show.venue?.name || "Unknown Venue"}
                          </Link>
                        ) : (
                          <span className="text-brand-primary">{rating.show.venue?.name || "Unknown Venue"}</span>
                        )}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-rating-gold fill-rating-gold" />
                          <span className="font-bold text-rating-gold">{rating.value}</span>
                        </div>
                        <span className="text-sm text-content-text-tertiary">
                          {formatDateLong(rating.createdAt.toISOString())}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-content-text-secondary mt-1">
                      <CalendarDays className="w-4 h-4" />
                      <span>{formatDateLong(rating.show.date)}</span>
                      {rating.show.venue?.city && rating.show.venue?.state && (
                        <span>
                          • {rating.show.venue.city}, {rating.show.venue.state}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="card-premium">
              <CardContent className="py-12 text-center">
                <Star className="w-12 h-12 text-content-text-tertiary mx-auto mb-4" />
                <h3 className="text-lg font-medium text-content-text-primary mb-2">No Show Ratings Yet</h3>
                <p className="text-content-text-secondary">
                  {isOwnProfile
                    ? "You haven't rated any shows yet. Browse shows and share your thoughts!"
                    : `${user.username} hasn't rated any shows yet.`}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Song Version Ratings Tab */}
        <TabsContent value="track-ratings" className="space-y-4">
          {trackRatings.length > 0 ? (
            <div className="space-y-4">
              {trackRatings.map((rating) => (
                <Card key={rating.id} className="card-premium">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {rating.track.slug ? (
                          <Link
                            to={`/tracks/${rating.track.slug}`}
                            className="text-brand-primary hover:text-brand-secondary transition-colors hover:underline"
                          >
                            {rating.track.song.title}
                          </Link>
                        ) : (
                          <Link
                            to={`/songs/${rating.track.song.slug}`}
                            className="text-brand-primary hover:text-brand-secondary transition-colors hover:underline"
                          >
                            {rating.track.song.title}
                          </Link>
                        )}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-rating-gold fill-rating-gold" />
                          <span className="font-bold text-rating-gold">{rating.value}</span>
                        </div>
                        <span className="text-sm text-content-text-tertiary">
                          {formatDateLong(rating.createdAt.toISOString())}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-content-text-secondary mt-1">
                      <span className="bg-content-bg px-2 py-1 rounded text-xs font-medium">
                        Set {rating.track.set} • #{rating.track.position}
                      </span>
                      {rating.track.show.slug ? (
                        <Link to={`/shows/${rating.track.show.slug}`} className="hover:underline">
                          {rating.track.show.venue?.name || "Unknown Venue"} • {formatDateLong(rating.track.show.date)}
                        </Link>
                      ) : (
                        <span>
                          {rating.track.show.venue?.name || "Unknown Venue"} • {formatDateLong(rating.track.show.date)}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="card-premium">
              <CardContent className="py-12 text-center">
                <Star className="w-12 h-12 text-content-text-tertiary mx-auto mb-4" />
                <h3 className="text-lg font-medium text-content-text-primary mb-2">No Song Version Ratings Yet</h3>
                <p className="text-content-text-secondary">
                  {isOwnProfile
                    ? "You haven't rated any song versions yet. Listen to shows and rate individual songs!"
                    : `${user.username} hasn't rated any song versions yet.`}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Blog Posts Tab */}
        <TabsContent value="blog" className="space-y-4">
          {blogPosts.length > 0 ? (
            <div className="space-y-4">
              {blogPosts.map((post) => (
                <Card key={post.id} className="card-premium">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl">
                        <Link
                          to={`/blog/${post.slug}`}
                          className="text-brand-primary hover:text-brand-secondary transition-colors hover:underline"
                        >
                          {post.title}
                        </Link>
                      </CardTitle>
                      <span className="text-sm text-content-text-tertiary">
                        {formatDateLong(post.createdAt.toISOString())}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-content-text-secondary line-clamp-3">{post.content?.substring(0, 200)}...</p>
                    <Link
                      to={`/blog/${post.slug}`}
                      className="inline-flex items-center gap-1 text-brand-primary hover:text-brand-secondary text-sm font-medium mt-3 hover:underline transition-colors"
                    >
                      Read more →
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="card-premium">
              <CardContent className="py-12 text-center">
                <Edit className="w-12 h-12 text-content-text-tertiary mx-auto mb-4" />
                <h3 className="text-lg font-medium text-content-text-primary mb-2">No Blog Posts Yet</h3>
                <p className="text-content-text-secondary">
                  {isOwnProfile
                    ? "You haven't published any blog posts yet. Share your thoughts about shows, music, and more!"
                    : `${user.username} hasn't published any blog posts yet.`}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Shows Attended Tab */}
        <TabsContent value="shows" className="space-y-4">
          {userAttendances.length > 0 ? (
            <div className="space-y-4">
              {userAttendances.map((attendance) => (
                <Card key={attendance.id} className="card-premium">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {attendance.show.slug ? (
                          <Link
                            to={`/shows/${attendance.show.slug}`}
                            className="text-brand-primary hover:text-brand-secondary transition-colors hover:underline"
                          >
                            {attendance.show.venue?.name || "Unknown Venue"}
                          </Link>
                        ) : (
                          <span className="text-brand-primary">{attendance.show.venue?.name || "Unknown Venue"}</span>
                        )}
                      </CardTitle>
                      <span className="text-sm text-content-text-tertiary">
                        Marked {formatDateLong(attendance.createdAt.toISOString())}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-content-text-secondary mt-1">
                      <CalendarDays className="w-4 h-4" />
                      <span>{formatDateLong(attendance.show.date)}</span>
                      {attendance.show.venue?.city && attendance.show.venue?.state && (
                        <span>
                          • {attendance.show.venue.city}, {attendance.show.venue.state}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="card-premium">
              <CardContent className="py-12 text-center">
                <CalendarDays className="w-12 h-12 text-content-text-tertiary mx-auto mb-4" />
                <h3 className="text-lg font-medium text-content-text-primary mb-2">No Shows Attended</h3>
                <p className="text-content-text-secondary">
                  {isOwnProfile
                    ? "You haven't marked any shows as attended yet. Browse shows and mark the ones you've been to!"
                    : `${user.username} hasn't marked any shows as attended yet.`}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
