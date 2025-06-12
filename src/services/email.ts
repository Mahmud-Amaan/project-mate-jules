import { Resend } from "resend";
import { generateInviteEmailContent } from "@/utils/emailTemplates";
import type { Role } from "@/types/permissions";

// Resend client will be initialized lazily
let resend: Resend | null = null;

function getResendClient() {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not set. Cannot send emails.");
    }
    resend = new Resend(apiKey);
  }
  return resend;
}

export async function sendInviteEmail({
    email,
    role,
    inviteUrl,
    projectName,
}: {
    email: string;
    role: Role;
    inviteUrl: string;
    projectName: string;
}) {
    const currentResendClient = getResendClient();
    const apiKey = process.env.RESEND_API_KEY; // For logging purposes

    console.log("📧 Starting email send process...");
    console.log("📝 Email details:", {
        to: email,
        projectName,
        role,
        hasApiKey: !!apiKey, // Check apiKey directly from env for logging
        apiKeyFirstChars: apiKey ? `${apiKey.substring(0, 5)}...` : "none",
    });

    try {
        const roleDisplay = role.charAt(0) + role.slice(1).toLowerCase();

        // IMPORTANT: Use Resend's default domain for testing
        // Gmail domains cannot be verified in Resend, so we must use Resend's domain
        const emailFrom = "onboarding@resend.dev";
        console.log(
            `📤 Using email sender: ${emailFrom} (Resend's default domain)`
        );
        console.log("Environment variables (not used):", {
            EMAIL_FROM: process.env.EMAIL_FROM,
            EMAIL_FORM: process.env.EMAIL_FORM,
        });
        console.log(
            "⚠️ Using Resend's default domain instead of configured domain due to verification requirements"
        );

        // Generate email content
        const htmlContent = generateInviteEmailContent(
            role,
            inviteUrl,
            projectName
        );
        console.log(
            "📄 Generated email HTML content (length):",
            htmlContent.length
        );

        console.log("📤 Sending email with config:", {
            from: emailFrom,
            to: email,
            subject: `Join ${projectName} as ${roleDisplay}`,
        });

        // Detailed logging before API call
        // No need to log apiKey here as getResendClient would throw if not set
        console.log("📨 Calling Resend API...");

        const result = await currentResendClient.emails.send({
            from: emailFrom,
            to: email,
            subject: `Join ${projectName} as ${roleDisplay}`,
            html: htmlContent,
        });

        console.log("✅ Email sent successfully:", result);
        return result;
    } catch (error) {
        console.error("❌ Email send error:", error);
        // The error from getResendClient will be more specific if it's an API key issue
        throw error;
    }
}
