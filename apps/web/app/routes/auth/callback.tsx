import { type LoaderFunctionArgs, redirect } from "react-router";
import { logger } from "~/server/logger";
import { getServerClient } from "~/server/supabase";

export async function loader({ request }: LoaderFunctionArgs) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const type = requestUrl.searchParams.get("type");
  const next = requestUrl.searchParams.get("next") || "/";

  logger.info({ message: "Auth callback", url: requestUrl.toString(), code: !!code, type });

  if (code) {
    const { supabase, headers } = getServerClient(request);
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      logger.error({ error, message: "Failed to exchange code for session" });
      return redirect("/auth/login", { headers });
    }

    // If this is a password recovery flow, redirect to reset password page
    if (type === "recovery") {
      logger.info("Redirecting to reset password page");
      return redirect("/auth/reset-password", { headers });
    }

    logger.info("Redirecting to next page", { next });
    return redirect(next, { headers });
  }

  logger.error("missing code from supabase auth callback");
  return redirect("/auth/login");
}
