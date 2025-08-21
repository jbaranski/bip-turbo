import { createBrowserClient } from "@supabase/ssr";
import { useEffect, useState } from "react";
import type { LoaderFunctionArgs } from "react-router-dom";
import { redirect, useNavigate, useRouteLoaderData } from "react-router-dom";
import { toast } from "sonner";
import { LoginForm } from "~/components/login-form";
import type { RootData } from "~/root";
import { getServerClient } from "~/server/supabase";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { supabase, headers } = getServerClient(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) return redirect("/", { headers });

  return;
};

export default function Login() {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const rootData = useRouteLoaderData("root") as RootData;
  const { SUPABASE_URL, SUPABASE_ANON_KEY, BASE_URL } = rootData.env;

  // Handle error messages from URL hash (e.g., expired OTP)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const errorParam = params.get("error");
      const errorDescription = params.get("error_description");
      const errorCode = params.get("error_code");

      if (errorParam && errorDescription) {
        if (errorCode === "otp_expired") {
          setError("Email link has expired. Please request a new password reset.");
        } else {
          setError(decodeURIComponent(errorDescription));
        }
        // Clear the hash from the URL
        window.history.replaceState(null, "", window.location.pathname);
      }
    }
  }, []);

  const doGoogleAuth = async () => {
    const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookieOptions: {
        path: "/",
        secure: true,
        sameSite: "lax",
      },
    });
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${BASE_URL}/auth/callback`,
      },
    });

    if (error) {
      console.error("Google auth error:", error);
      setError("An unexpected error occurred");
    }
  };

  const doEmailLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Login error:", error);
        setError(error.message);
        return;
      }

      console.log("Login successful:", data);
      navigate("/");
    } catch (err) {
      console.error("Unexpected error during login:", err);
      setError("An unexpected error occurred");
    }
  };

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm space-y-6">
        {error && (
          <div className="relative border border-red-500/20 bg-red-900/10 backdrop-blur-2xl transition-colors duration-300 rounded-lg p-4">
            <div className="absolute inset-0 rounded-[inherit] bg-gradient-to-b from-red-500/10 via-transparent to-transparent" />
            <div className="absolute inset-0 rounded-[inherit] shadow-2xl shadow-red-500/5" />
            <div className="relative">
              <p className="text-sm text-red-200">{error}</p>
            </div>
          </div>
        )}
        <LoginForm onSubmit={doEmailLogin} onGoogleClick={doGoogleAuth} />
      </div>
    </div>
  );
}
