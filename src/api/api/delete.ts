import { DB } from "../../db/db";
import { Templates } from "../../templates/templates";
import { Context } from "hono";

type DeleteJobContext = {
  source?: string;
  filter?: string;
  tab?: string;
};

async function renderDeleteResponse(c: Context, context: DeleteJobContext) {
  if (context.source === "compose") {
    return c.html(await Templates.Compose({ showProgress: false, jobId: "" }));
  }

  if (context.source === "image") {
    return c.html(
      await Templates.DistinctImage({ showProgress: false, jobId: "" }),
    );
  }

  if (context.source === "audio") {
    return c.html(
      await Templates.DistinctAudio({ showProgress: false, jobId: "" }),
    );
  }

  const jobs = await DB.Jobs.list();
  if (jobs.length === 0) {
    return c.html(Templates.NotSelectedFragment());
  }

  const filter = context.filter ?? "all";
  const tab = context.tab ?? "status";
  const nextJobId = jobs[0].id;

  return c.html(
    await Templates.JobsFragment({ jobId: nextJobId, filter, tab }),
  );
}

export async function delete_job(
  c: Context,
  jobId: string,
  context: DeleteJobContext,
) {
  await DB.Jobs.deleteById(jobId);

  return renderDeleteResponse(c, context);
}
