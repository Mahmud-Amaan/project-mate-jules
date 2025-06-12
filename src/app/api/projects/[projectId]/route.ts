/**
 * API Route: Get Project by ID
 * This endpoint retrieves a specific project by its ID
 */

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// Define a more specific type for user details
type UserDetail = {
  id: string;
  name: string;
  email?: string;
  avatar_url?: string;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    // Get the project ID from the URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const projectId = pathParts[pathParts.length - 1];

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    // Create a Supabase client
    const supabase = await createClient();

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get the project
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    // Get project members separately
    const { data: members, error: membersError } = await supabase
      .from("project_members")
      .select("id, user_id, role")
      .eq("project_id", projectId);

    if (membersError) {
      console.error("Error fetching project members:", membersError);
      // Continue with empty members array
    }

    if (projectError) {
      console.error("Error fetching project:", projectError);
      return NextResponse.json(
        { error: "Failed to fetch project" },
        { status: 500 }
      );
    }

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Get user information for members
    const memberUserIds = members?.map(member => member.user_id) || [];
    let userDetails: Record<string, UserDetail> = {};

    if (memberUserIds.length > 0) {
      try {
        // Check if profiles table exists first
        const { error: tableCheckError } = await supabase
          .from("profiles")
          .select("id")
          .limit(1)
          .maybeSingle();

        // If profiles table exists, use it
        if (!tableCheckError) {
          const { data: profiles, error: profilesError } = await supabase
            .from("profiles")
            .select("id, full_name, email, avatar_url")
            .in("id", memberUserIds);

          if (!profilesError && profiles) {
            // Create a map of user details by ID for easy lookup
            userDetails = profiles.reduce((acc, profile) => {
              acc[profile.id] = {
                id: profile.id,
                name: profile.full_name || '', // Ensure name is always string
                email: profile.email,
                avatar_url: profile.avatar_url
              };
              return acc;
            }, {} as Record<string, UserDetail>);

            // If we successfully got profiles, continue with these details
            // (Don't return early as this was causing the route handler to fail)
          }
        }

        // If profiles table doesn't exist or there was an error, fall back to auth.users
        console.log("Profiles table not found or error, falling back to auth.users");

        // Fallback: Get user data from auth.users
        const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();

        if (!authError && authUsers) {
          userDetails = authUsers
            .filter(user => memberUserIds.includes(user.id))
            .reduce((acc, user) => {
              const metadata = user.user_metadata || {};
              acc[user.id] = {
                id: user.id,
                name: metadata.full_name || user.email?.split('@')[0] || 'Unknown User',
                email: user.email,
                avatar_url: metadata.avatar_url
              };
              return acc;
            }, {} as Record<string, UserDetail>);
        }
      } catch (userError) {
        console.error("Error processing user data:", userError);
      }
    }

    // Check if the user is a member of the project
    const isMember = members?.some(
      (member) => member.user_id === user.id
    ) || false;

    if (!isMember && project.owner_id !== user.id) {
      return NextResponse.json(
        { error: "You don't have access to this project" },
        { status: 403 }
      );
    }

    // Format the members data
    const formattedMembers = (members || []).map((member) => {
      const userDetail = userDetails[member.user_id] || {};
      return {
        id: member.id,
        userId: member.user_id,
        role: member.role,
        name: userDetail.name || "Unknown User",
        email: userDetail.email,
        avatarUrl: userDetail.avatar_url
      };
    });

    // Format the project data
    const formattedProject = {
      id: project.id,
      name: project.name,
      description: project.description,
      ownerId: project.owner_id,
      created_at: project.created_at,
      updated_at: project.updated_at,
      readme: project.readme,
      members: formattedMembers,
      isOwner: project.owner_id === user.id
    };

    return NextResponse.json(formattedProject);
  } catch (error) {
    console.error("Error in project API:", error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}
