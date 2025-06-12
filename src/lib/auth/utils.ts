"use server"; // Adding "use server" as it uses server-side Supabase client

import { NextResponse } from 'next/server';
import { createClient } from "@/utils/supabase/server";

/**
 * Validates user authentication on the server.
 * @returns An object containing the user if authenticated, or an error object with a NextResponse.
 */
export async function validateAuth() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    // Return an object that the caller can use to build a NextResponse
    // Or, if this function is ONLY used in contexts that can directly return NextResponse,
    // then the original return is fine. For broader lib use, returning a structured error is better.
    return { user: null, error: { message: 'Authentication required', status: 401 } };
  }

  return { user, error: null };
}
