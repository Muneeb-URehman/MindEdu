import { Link, useNavigate } from "@tanstack/react-router";
import { GraduationCap, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useAuth, type AppRole } from "@/hooks/useAuth";

export function AppShell({ children }: { children: ReactNode }) {
  const { fullName, role, session, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-hero-gradient text-primary-foreground">
              <GraduationCap className="size-5" />
            </span>
            <span className="font-display text-lg font-semibold">AIED School</span>
          </Link>
          <div className="flex items-center gap-3">
            {role ? (
              <Link
                to={role === "teacher" ? "/teacher" : "/student"}
                className="text-sm font-semibold text-muted-foreground hover:text-foreground"
              >
                {role === "teacher" ? "Teacher dashboard" : "My worksheets"}
              </Link>
            ) : null}
            {session ? (
              <>
                <span className="hidden text-sm text-muted-foreground sm:inline">{fullName}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await signOut();
                    navigate({ to: "/auth", replace: true });
                  }}
                >
                  <LogOut className="size-4" /> Sign out
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => navigate({ to: "/auth" })}>
                Sign in
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}

export function RequireRole({ role, children }: { role: AppRole; children: ReactNode }) {
  const { session, role: userRole, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return <p className="py-16 text-center text-muted-foreground">Loading…</p>;
  }

  if (!session) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Please sign in to continue.</p>
        <Button className="mt-4" onClick={() => navigate({ to: "/auth" })}>
          Go to sign in
        </Button>
      </div>
    );
  }

  if (userRole !== role) {
    return (
      <div className="py-16 text-center">
        <h2 className="text-xl font-semibold">This area is for {role}s</h2>
        <p className="mt-2 text-muted-foreground">Your account does not have access to this page.</p>
        <Button
          className="mt-4"
          onClick={() => navigate({ to: userRole === "teacher" ? "/teacher" : "/student" })}
        >
          Go to my dashboard
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
