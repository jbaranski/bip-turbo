import { publicLoader } from "~/lib/base-loaders";
import { badRequest } from "~/lib/errors";
import { services } from "~/server/services";

export const loader = publicLoader(async ({ params, context }) => {
  const { currentUser } = context;
  const { trackId } = params;

  if (!trackId) return badRequest();

  // Get fresh track data with rating stats
  const track = await services.tracks.findById(trackId);
  
  if (!track) {
    return new Response(JSON.stringify({ error: "Track not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Get user's rating if logged in
  let userRating = null;
  if (currentUser) {
    const localUser = await services.users.findByEmail(currentUser.email);
    if (localUser) {
      userRating = await services.ratings.getByRateableIdAndUserId(trackId, "Track", localUser.id);
    }
  }

  // Get the fresh average rating and count (already on track from DB)
  const averageRating = track.averageRating || 0;
  const ratingsCount = track.ratingsCount || 0;

  return {
    track: {
      id: track.id,
      songTitle: track.song?.title || "",
      averageRating,
      ratingsCount,
      likesCount: track.likesCount || 0,
      note: track.note,
    },
    userRating: userRating?.value || null,
  };
});