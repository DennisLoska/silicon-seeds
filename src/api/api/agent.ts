import { AgenticEditor } from "../../hypercut/agentic-editor";

export async function handleAgentChat(jobId: string, c: any): Promise<Response> {
  if (!jobId) {
    return Response.json({ error: "job_id required" }, { status: 400 });
  }

  try {
    const body = await c.req.json();
    const message = body.message?.trim();

    if (!message) {
      return Response.json({ error: "message required" }, { status: 400 });
    }

    return await AgenticEditor.chatStream(jobId, message);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}
