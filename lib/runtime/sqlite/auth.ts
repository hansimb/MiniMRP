type DesktopBrowserClient = {
  auth: {
    signInWithPassword(args: { email: string; password: string }): Promise<{ error: { message: string } | null }>;
    signOut(): Promise<{ error: null }>;
  };
};

export function createBrowserClient(): DesktopBrowserClient {
  return {
    auth: {
      async signInWithPassword() {
        return { error: null };
      },
      async signOut() {
        return { error: null };
      }
    }
  };
}

export async function getAdminFlags() {
  return {
    isAuthenticated: true,
    isAdmin: true
  };
}

export async function isUserAdmin(_userId: string) {
  return true;
}
