import { Hono } from "hono";

const app = new Hono();

// Delete modal route - must be registered before catch-all
app.get("/delete-modal", async (c) => {
  const jobId = c.req.query("jobId");

  // Return the complete modal structure with modal-open className
  return c.html(
    <dialog id="delete-confirm-modal" className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg">Delete Job</h3>
        <p className="py-4">
          Are you sure you want to delete this job? This action cannot be
          undone.
        </p>
        <div className="modal-action">
          <button
            className="btn"
            hx-swap="none"
            onclick="this.closest('.modal').classList.remove('modal-open')"
          >
            Cancel
          </button>
          <button
            id="confirm-delete-btn"
            className="btn btn-error"
            hx-delete={`/api/jobs/${jobId}`}
            hx-target="#job-content-container"
            hx-swap="innerHTML"
            hx-trigger="click"
          >
            Delete
          </button>
        </div>
      </div>
    </dialog>,
  );
});

export default app;
