import { protectedAction, publicLoader } from "~/lib/base-loaders";
import { badRequest, methodNotAllowed, unauthorized } from "~/lib/errors";
import { logger } from "~/lib/logger";
import { services } from "~/server/services";

export const loader = publicLoader(async ({ request }) => {
  const url = new URL(request.url);
  const showId = url.searchParams.get("showId");

  if (!showId) {
    return badRequest();
  }

  const attendances = await services.attendances.findByShowId(showId);

  return new Response(JSON.stringify({ attendances }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

export const action = protectedAction(async ({ request, params, context }) => {
  const { currentUser } = context;

  if (request.method === "POST") {
    try {
      const body = await request.json();
      const { showId } = body;

      if (!showId) {
        return badRequest();
      }

      // Validate that the show exists
      const show = await services.shows.findById(showId);
      if (!show) {
        logger.error("Show not found for attendance creation:", { showId, userId: currentUser.id });
        return new Response(JSON.stringify({ error: "Show not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Validate that the user still exists in the database
      const user = await services.users.findById(currentUser.id);
      if (!user) {
        logger.error("User not found for attendance creation:", { showId, userId: currentUser.id });
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Check if user already has an attendance for this show
      const existingAttendance = await services.attendances.findByUserIdAndShowId(currentUser.id, showId);
      if (existingAttendance) {
        return { attendance: existingAttendance };
      }

      const attendance = await services.attendances.create({
        userId: currentUser.id,
        showId,
      });

      return { attendance };
    } catch (error) {
      logger.error("Error creating attendance:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to create attendance");
    }
  }

  if (request.method === "DELETE") {
    try {
      const body = await request.json();
      const { id } = body;
      if (!id) return badRequest();

      // Verify the attendance belongs to the user
      const attendance = await services.attendances.findById(id);
      if (!attendance || attendance.userId !== currentUser.id) {
        return unauthorized();
      }

      await services.attendances.delete(id);
      return new Response(JSON.stringify({ deletedId: id }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      logger.error("Error deleting attendance:", error);
      return new Response(JSON.stringify({ error: "Failed to delete attendance" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return methodNotAllowed();
});
