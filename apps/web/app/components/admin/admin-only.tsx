import { useSession } from "~/hooks/use-session";

interface AdminOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function AdminOnly({ children, fallback = null }: AdminOnlyProps) {
  const { user, loading: isLoading } = useSession();

  // If Supabase context is not loaded yet, render nothing
  if (isLoading) {
    return null;
  }

  // Check for admin flag in app_metadata (server-controlled, secure)
  if (user?.app_metadata?.isAdmin === true) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
