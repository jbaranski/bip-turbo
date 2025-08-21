import { adminAction } from "~/lib/base-loaders";
import { services } from "~/server/services";

// PUT /api/tracks/:id - Update a track
// DELETE /api/tracks/:id - Delete a track
export const action = adminAction(async ({ request, params }) => {
  const method = request.method;
  const { id } = params;

  if (!id) {
    throw new Response("Track ID is required", { status: 400 });
  }

  if (method === "PUT") {
    const data = await request.json();
    console.log(`Updating track ${id}:`, data);

    try {
      const track = await services.tracks.update(id, {
        songId: data.songId,
        set: data.set,
        position: data.position,
        segue: data.segue,
        note: data.note,
      });

      // Update annotations if provided
      if (data.annotationDesc !== undefined) {
        await services.annotations.upsertMultipleForTrack(id, data.annotationDesc);
      }

      // Fetch the track with annotations
      const trackWithAnnotations = await services.tracks.findById(id);

      console.log(`Updated track ${id}`);
      return trackWithAnnotations;
    } catch (error) {
      console.error(`Error updating track ${id}:`, error);
      throw new Response("Failed to update track", { status: 500 });
    }
  }

  if (method === "DELETE") {
    console.log(`Deleting track ${id}`);

    try {
      // Delete annotations first (in case cascade delete is not set up)
      await services.annotations.deleteByTrackId(id);
      
      await services.tracks.delete(id);
      console.log(`Deleted track ${id}`);
      return { success: true };
    } catch (error) {
      console.error(`Error deleting track ${id}:`, error);
      throw new Response("Failed to delete track", { status: 500 });
    }
  }

  throw new Response("Method not allowed", { status: 405 });
});
