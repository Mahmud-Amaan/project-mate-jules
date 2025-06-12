"use client";

import type React from "react";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Sparkles,
  ArrowLeft,
  Loader2,
  FileText,
  Lightbulb,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export default function NewProjectPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectIdea, setProjectIdea] = useState("");
  const [activeTab, setActiveTab] = useState("idea");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (projectIdea.trim().length < 10) {
      setError("Please provide a more detailed project description");
      toast.warning("More details needed");
      return;
    }

    setIsLoading(true);
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      // Show a loading toast
      toast.loading("Creating your project");

      const response = await fetch("/api/projects/create", {
        method: "POST",
        body: formData,
      });

      // Handle non-JSON responses
      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        try {
          data = await response.json();
        } catch (jsonError) {
          console.error("Error parsing JSON response:", jsonError);
          throw new Error("Server returned invalid data. Please try again.");
        }
      } else {
        // Handle non-JSON response
        const textResponse = await response.text();
        console.error("Non-JSON response received:", textResponse);
        throw new Error("Server returned an unexpected response. Please try again.");
      }

      if (!response.ok) {
        // Handle specific status codes
        if (response.status === 429) {
          throw new Error("AI service rate limit exceeded. Please try again later.");
        }
        throw new Error(data.error || "Failed to create project");
      }

      if (data.projectId) {
        // Show success toast
        toast.dismiss();
        toast.success("Project created!");

        // Add a small delay before navigation to ensure the toast is visible
        // and to give the server a moment to complete any background tasks
        setTimeout(() => {
          // Use window.location for a full page refresh instead of router.push
          // This can help with issues where the client-side navigation fails
          window.location.href = `/dashboard/projects/${data.projectId}`;
        }, 1500);
      } else {
        throw new Error("No project ID returned");
      }
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e.message : "An unexpected error occurred";
      setError(errorMessage);

      toast.error("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-2">
            <Link href="/dashboard">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back to Dashboard</span>
              </Button>
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Create New Project
            </h1>
          </div>
          <Link href="/dashboard">
            <Button variant="outline" size="sm">
              Cancel
            </Button>
          </Link>
        </div>

        <Card className="border-2 border-slate-200 dark:border-slate-800 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-green-500" />
              Project Generator
            </CardTitle>
            <CardDescription>
              Describe your project idea, and our AI will help you set up a
              structured project with tasks.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="py-6">
              <Tabs
                defaultValue="idea"
                className="w-full"
                value={activeTab}
                onValueChange={setActiveTab}
              >
                <TabsList className="grid grid-cols-2 mb-4">
                  <TabsTrigger
                    value="idea"
                    className="flex items-center cursor-pointer gap-2"
                  >
                    <Lightbulb className="h-4 w-4" />
                    Project Idea
                  </TabsTrigger>
                  <TabsTrigger
                    value="template"
                    className="flex items-center cursor-pointer gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    Templates
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="idea" className="space-y-4">
                  <div className="space-y-4">
                    <label htmlFor="idea" className="text-sm font-medium ">
                      Describe Your Project Idea
                    </label>
                    <Textarea
                      id="idea"
                      name="idea"
                      rows={8}
                      value={projectIdea}
                      onChange={(e) => setProjectIdea(e.target.value)}
                      className="w-full p-4 border rounded-lg resize-none transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                      placeholder=" I want to build a task management app for remote teams with features like task assignment, due dates, priority levels, and progress tracking..."
                      required
                      disabled={isLoading}
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      The more details you provide, the better we can structure
                      your project.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg">
                    <Lightbulb className="h-5 w-5 text-amber-500 shrink-0" />
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      Include your project goals, target audience, key features,
                      and any technical requirements.
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="template" className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <TemplateCard
                      title="Web Application"
                      description="Frontend, backend, database structure, and API endpoints."
                      onClick={() => {
                        setProjectIdea(
                          "I want to build a web application with user authentication, dashboard, and data management features."
                        );
                        setActiveTab("idea");
                      }}
                    />
                    <TemplateCard
                      title="Mobile App"
                      description="Screens, navigation, state management, and API integration."
                      onClick={() => {
                        setProjectIdea(
                          "I want to build a mobile app with user profiles, content feed, and notification system."
                        );
                        setActiveTab("idea");
                      }}
                    />
                    <TemplateCard
                      title="E-commerce Store"
                      description="Product catalog, cart, checkout, and payment processing."
                      onClick={() => {
                        setProjectIdea(
                          "I want to build an e-commerce store with product listings, shopping cart, checkout process, and payment integration."
                        );
                        setActiveTab("idea");
                      }}
                    />
                    <TemplateCard
                      title="Content Platform"
                      description="Content creation, publishing, and subscription management."
                      onClick={() => {
                        setProjectIdea(
                          "I want to build a content platform where creators can publish articles/videos and users can subscribe to their favorite creators."
                        );
                        setActiveTab("idea");
                      }}
                    />
                  </div>
                </TabsContent>
              </Tabs>

              {error && (
                <div className="mt-4 p-3 text-sm bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 rounded-lg">
                  {error}
                </div>
              )}
            </CardContent>

            <CardFooter className="flex justify-end space-x-4 border-t pt-6">
              <Link href="/dashboard">
                <Button type="button" variant="outline" disabled={isLoading}>
                  Cancel
                </Button>
              </Link>
              <Button
                type="submit"
                disabled={isLoading || projectIdea.trim().length < 10}
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl hover:shadow-green-500/20 transition-all duration-300"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Project...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Project
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}

function TemplateCard({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <div
      className="p-4 border rounded-lg cursor-pointer hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors"
      onClick={onClick}
    >
      <h3 className="font-medium mb-1">{title}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {description}
      </p>
    </div>
  );
}
