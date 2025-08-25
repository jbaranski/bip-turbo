import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { serialize } from "cookie";
import { env } from "./env";

export const getServiceRoleClient = () => {
  // Service role client for admin operations
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

export const getServerClient = (request: Request) => {
  const headers = new Headers();

  const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => {
        const cookie = request.headers.get("Cookie") ?? "";
        return cookie.split(";").reduce(
          (acc, part) => {
            const [key, ...value] = part.split("=");
            if (key) {
              acc.push({
                name: key.trim(),
                value: value.join("=").trim(),
              });
            }
            return acc;
          },
          [] as { name: string; value: string }[],
        );
      },
      setAll: (cookies) => {
        for (const cookie of cookies) {
          headers.append(
            "Set-Cookie",
            serialize(cookie.name, cookie.value, {
              ...cookie.options,
              path: "/",
            }),
          );
        }
      },
    },
  });

  return { supabase, headers };
};
