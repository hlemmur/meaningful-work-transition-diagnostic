import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function supabaseAuthEnv() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase auth is not configured");
  }
  return { url, anonKey };
}

type CookieToSet = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

export function createSupabaseAuthClient(cookieStore: {
  getAll: () => { name: string; value: string }[];
  setAll: (cookies: CookieToSet[]) => void;
}) {
  const { url, anonKey } = supabaseAuthEnv();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: cookieStore.getAll,
      setAll: cookieStore.setAll,
    },
  });
}

export async function createServerAuthClient() {
  const store = await cookies();
  return createSupabaseAuthClient({
    getAll: () => store.getAll(),
    setAll: (cookiesToSet) => {
      cookiesToSet.forEach(({ name, value, options }) => {
        store.set(name, value, options);
      });
    },
  });
}

export async function sendOperatorMagicLink(email: string, redirectTo: string) {
  const supabase = await createServerAuthClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: true,
    },
  });
  if (error) {
    throw new Error("Could not send magic link");
  }
}

export async function readLiveUserEmail() {
  try {
    const supabase = await createServerAuthClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

export async function readLiveUserEmailFromRequest(request: NextRequest) {
  const response = NextResponse.next({ request });
  try {
    const supabase = createSupabaseAuthClient({
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    });
    const { data } = await supabase.auth.getUser();
    return { email: data.user?.email ?? null, response };
  } catch {
    return { email: null, response };
  }
}

export async function exchangeMagicLinkCode(code: string) {
  const supabase = await createServerAuthClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    throw new Error("Could not complete magic link sign-in");
  }
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? null;
}

export async function signOutLiveOperator() {
  const supabase = await createServerAuthClient();
  await supabase.auth.signOut();
}
