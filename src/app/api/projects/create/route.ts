import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { db } from "@/db";
import { projectMembers } from "@/db/schema";
import { createOptimizedProject } from "@/lib/ai/tools/project-creator/optimized-creator";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const idea = formData.get("idea") as string;

    if (!idea) {
      return NextResponse.json(
        { error: "Project idea is required" },
        { status: 400 }
      );
    }

    // Use the optimized project creation function
    try {
      const result = await createOptimizedProject(user.id, idea);

      if (!result || !result.project || !result.project.id) {
        return NextResponse.json(
          { error: "Failed to create project. Please try again with a different description." },
          { status: 500 }
        );
      }

      // Add the creator as a project member
      await db.insert(projectMembers).values({
        projectId: result.project.id,
        userId: user.id,
        role: "OWNER",
      });

      console.log(`Created project ${result.project.id} with ${result.columns.length} columns and ${result.taskCount} tasks`);

      // Return the new project ID
      return NextResponse.json({
        success: true,
        projectId: result.project.id,
      });
    } catch (error) {
      console.error("Error creating project:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // Check for rate limit errors
      if (errorMessage.includes("rate limit") || errorMessage.includes("quota")) {
        return NextResponse.json(
          { error: "AI service rate limit exceeded. Please try again later." },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: "Failed to create project. Please try again with a different description." },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Project creation error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
