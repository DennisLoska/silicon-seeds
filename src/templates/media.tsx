import { Job } from "../events/events";

export const media = async (job: Job) => {
  return (
    <div className="space-y-4">
      <h2 className="text-3xl font-bold mb-4">Media</h2>
      <div className="card bg-base-200 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base-content/70 text-sm uppercase tracking-widest font-bold">
            Media
          </h2>
          <p>{`Media content for job ${job.id} will be displayed here.`}</p>
        </div>
      </div>
    </div>
  );
};
