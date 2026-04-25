import { NextRequest, NextResponse } from "next/server";
import { launchSocialTask } from "@/lib/server-store";
import type { SocialTaskId } from "@/lib/content";

type LaunchTaskRequest = {
  address?: string;
  taskId?: SocialTaskId;
  quoteDraft?: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as LaunchTaskRequest;

  if (!body.address || !body.taskId) {
    return NextResponse.json(
      { ok: false, error: "Address and taskId are required." },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json({
      ok: true,
      ...launchSocialTask(body.address, body.taskId, body.quoteDraft),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Task launch failed.",
      },
      { status: 400 }
    );
  }
}
