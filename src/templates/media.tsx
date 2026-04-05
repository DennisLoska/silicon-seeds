import { Job } from "../events/events";

export const media = async (job: Job) => {
  return (
    <div className="space-y-4">
      <h2 className="text-3xl font-bold mb-4">Media</h2>
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <p>{`Media content for job ${job.id} will be displayed here.`}</p>
        </div>
      </div>
    </div>
  );
};
