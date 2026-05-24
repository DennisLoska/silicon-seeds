import { Hono } from "hono";

const app = new Hono();

// Job action modal route - must be registered before catch-all
app.get("/job-action-modal", async (c) => {
  const jobId = c.req.query("jobId");
  const action = c.req.query("action") ?? "delete";
  const source = c.req.query("source") ?? "jobs";
  const filter = c.req.query("filter") ?? "all";
  const tab = c.req.query("tab") ?? "status";

  const isDelete = action === "delete";
  const modalId = "job-action-modal";
  const title = isDelete ? "Delete Job" : "Cancel Job";
  const description = isDelete
    ? "Are you sure you want to delete this job? This action cannot be undone."
    : "Are you sure you want to cancel this job? Running work will be interrupted and queued work will be discarded.";
  const buttonClass = "btn btn-error";
  const buttonLabel = isDelete ? "Delete" : "Cancel Job";
  const methodAttr = isDelete
    ? { "hx-delete": `/api/jobs/${jobId}?source=${source}&filter=${filter}&tab=${tab}` }
    : { "hx-post": `/api/jobs/${jobId}/cancel?source=${source}&filter=${filter}&tab=${tab}` };
  const target = source === "jobs" ? "#job-content-container" : "#job-content-container";

  return c.html(
    <dialog id={modalId} className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg">{title}</h3>
        <p className="py-4">{description}</p>
        <div className="modal-action">
          <button
            className="btn"
            hx-swap="none"
            onclick="this.closest('.modal').classList.remove('modal-open')"
          >
            Cancel
          </button>
          <button
            id="confirm-job-action-btn"
            className={buttonClass}
            {...methodAttr}
            hx-target={target}
            hx-swap="innerHTML"
            hx-trigger="click"
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </dialog>,
  );
});

export default app;
