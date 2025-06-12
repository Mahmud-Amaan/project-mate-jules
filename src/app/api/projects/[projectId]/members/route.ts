import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { db } from "@/db";
import { projectMembers, authUsers, userRoleEnum } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url);
        const pathParts = url.pathname.split("/");
        const projectId = pathParts[pathParts.length - 2];
        console.log(`API: Fetching members for project ${projectId}`);

        const supabase = await createClient();
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            console.log("API: Authentication error or no user found");
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // Get members with auth user information
        try {
            const members = await db
                .select({
                    id: projectMembers.id,
                    userId: projectMembers.userId,
                    projectId: projectMembers.projectId,
                    role: projectMembers.role,
                    createdAt: projectMembers.createdAt,
                    updatedAt: projectMembers.updatedAt,
                    metadata: authUsers.metadata,
                })
                .from(projectMembers)
                .leftJoin(authUsers, eq(projectMembers.userId, authUsers.id))
                .where(eq(projectMembers.projectId, projectId));

            if (!members || members.length === 0) {
                console.log(`API: No members found for project ${projectId}`);
                return NextResponse.json([]);
            }

            const membersWithDefaults = members.map((member) => {
                // member.metadata should be typed as UserMetadata | null from the schema
                const userMeta = member.metadata;

                const email = userMeta?.email || '';
                const fullName = userMeta?.full_name || '';
                const avatarUrl = userMeta?.avatar_url || '';

                return {
                    ...member,
                    email: email,
                    name: fullName || email.split('@')[0] || 'Unknown User',
                    avatar: avatarUrl,
                    // Remove the original metadata field from the final object sent to client
                    metadata: undefined,
                };
            });

            console.log(
                `API: Found ${membersWithDefaults.length} members for project ${projectId}`
            );

            return NextResponse.json(membersWithDefaults);
        } catch (dbError) {
            console.error("Database error fetching project members:", dbError);
            return NextResponse.json(
                { error: "Database error fetching members" },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error("Error fetching project members:", error);
        return NextResponse.json(
            { error: "Failed to fetch members" },
            { status: 500 }
        );
    }
}

// Update member role
export async function PATCH(request: NextRequest) {
    try {
        // Extract projectId from URL
        const url = new URL(request.url);
        const pathParts = url.pathname.split("/");
        const projectId = pathParts[pathParts.length - 2]; // projectId is the second-to-last part

        const supabase = await createClient();
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // Check if user is project owner or manager
        const [membership] = await db
            .select()
            .from(projectMembers)
            .where(
                and(
                    eq(projectMembers.projectId, projectId),
                    eq(projectMembers.userId, user.id)
                )
            );

        if (
            !membership ||
            (membership.role !== "OWNER" && membership.role !== "MANAGER")
        ) {
            return NextResponse.json(
                { error: "You don't have permission to update member roles" },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { memberId, role, status } = body;

        if (!memberId || (!role && !status)) {
            return NextResponse.json(
                { error: "Member ID and either role or status are required" },
                { status: 400 }
            );
        }

        // Don't allow changing the role of the project owner
        const [memberToUpdate] = await db
            .select()
            .from(projectMembers)
            .where(eq(projectMembers.id, memberId));

        if (!memberToUpdate) {
            return NextResponse.json(
                { error: "Member not found" },
                { status: 404 }
            );
        }

        // Check if the target member is the project owner
        const [project] = await db
            .select()
            .from(projectMembers)
            .where(
                and(
                    eq(projectMembers.projectId, projectId),
                    eq(projectMembers.role, "OWNER")
                )
            );

        if (memberToUpdate.userId === project?.userId) {
            return NextResponse.json(
                { error: "Cannot change the role of the project owner" },
                { status: 403 }
            );
        }

        // Prepare update data
        // Prepare update data with correct types
        const updateData: {
            updatedAt: Date;
            role?: (typeof userRoleEnum.enumValues)[number];
        } = {
            updatedAt: new Date(),
        };

        // Add role to update if provided
        if (role) {
            // Validate role is one of the allowed values
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (userRoleEnum.enumValues.includes(role as any)) {
                updateData.role =
                    role as (typeof userRoleEnum.enumValues)[number];
            }
        }

        // Update the member
        await db
            .update(projectMembers)
            .set(updateData)
            .where(eq(projectMembers.id, memberId));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error updating member role:", error);
        return NextResponse.json(
            { error: "Failed to update member role" },
            { status: 500 }
        );
    }
}

// Remove member from project
export async function DELETE(request: NextRequest) {
    try {
        // Extract projectId from URL
        const url = new URL(request.url);
        const pathParts = url.pathname.split("/");
        const projectId = pathParts[pathParts.length - 2]; // projectId is the second-to-last part

        const supabase = await createClient();
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // Check if user is project owner or manager
        const [membership] = await db
            .select()
            .from(projectMembers)
            .where(
                and(
                    eq(projectMembers.projectId, projectId),
                    eq(projectMembers.userId, user.id)
                )
            );

        if (
            !membership ||
            (membership.role !== "OWNER" && membership.role !== "MANAGER")
        ) {
            return NextResponse.json(
                { error: "You don't have permission to remove members" },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        const memberId = searchParams.get("memberId");

        if (!memberId) {
            return NextResponse.json(
                { error: "Member ID is required" },
                { status: 400 }
            );
        }

        // Don't allow removing the project owner
        const [memberToRemove] = await db
            .select()
            .from(projectMembers)
            .where(eq(projectMembers.id, memberId));

        if (!memberToRemove) {
            return NextResponse.json(
                { error: "Member not found" },
                { status: 404 }
            );
        }

        // Check if the target member is the project owner
        const [project] = await db
            .select()
            .from(projectMembers)
            .where(
                and(
                    eq(projectMembers.projectId, projectId),
                    eq(projectMembers.role, "OWNER")
                )
            );

        if (memberToRemove.userId === project?.userId) {
            return NextResponse.json(
                { error: "Cannot remove the project owner" },
                { status: 403 }
            );
        }

        // Remove the member
        await db.delete(projectMembers).where(eq(projectMembers.id, memberId));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error removing member:", error);
        return NextResponse.json(
            { error: "Failed to remove member" },
            { status: 500 }
        );
    }
}
