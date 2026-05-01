import { Icons } from "./icons";
import { ErrorToast } from "./toast";

interface DistinctImageProps {
  showProgress?: boolean;
  jobId?: string;
}

export const DistinctImage = ({
  showProgress = false,
  jobId = "",
}: DistinctImageProps) => (
  <div className="flex flex-col sm:px-6 py-6 xl:h-full bg-base-200">
    <ErrorToast />
    {/* Kanban-style Card Container */}
    <form
      className="flex flex-col xl:flex-row gap-4 xl:h-full"
      hx-post="/api/jobs/images"
      hx-encoding="multipart/form-data"
      hx-swap="none"
      hx-disable-element="#submit-btn"
    >
      {/* Left column: Prompt + Settings + Job Progress stacked vertically */}
      <div className="flex flex-col w-full xl:w-[50%] gap-4">
        {/* Card 1: Prompt Input */}
        <div className="card bg-base-100 shadow-xl w-full flex-none flex flex-col overflow-hidden">
          <div className="card-body flex flex-col p-4">
            <h2 className="card-title text-lg font-semibold flex items-center gap-2 mb-3 flex-none">
              <Icons.PromptIcon />
              Prompt
            </h2>
            <textarea
              name="prompt"
              className="textarea textarea-ghost w-full flex-grow resize-none mb-4 min-h-[250px] focus:outline-none"
              placeholder="Describe the image you want to generate..."
            ></textarea>
          </div>
        </div>

        {/* Settings + Action Buttons row */}
        <div className="flex flex-row justify-between gap-4">
          {/* Card 2: AI Model Selection */}
          <div className="card bg-base-100 shadow-xl w-auto min-w-[200px] flex-none flex flex-col">
            <div className="card-body flex flex-col p-4">
              <h2 className="card-title text-lg font-semibold flex items-center gap-2 mb-3">
                <Icons.SparkleIcon />
                AI Model
              </h2>

              {/* Image Model Selection */}
              <div className="form-control">
                <label className="label cursor-pointer">
                  <span className="label-text font-medium flex items-center gap-2">
                    <Icons.PhotoCameraSmall />
                    Image Generation Model
                  </span>
                </label>
                <select
                  name="image_model"
                  className="select select-bordered w-full flex-none"
                >
                  <option value="z-image-turbo">Z-Image-Turbo</option>
                </select>
              </div>
            </div>
          </div>

          {/* Card 3: Generation Options */}
          <div className="card bg-base-100 shadow-xl w-auto min-w-[250px] flex-none flex flex-col">
            <div className="card-body flex flex-col p-4">
              <h2 className="card-title text-lg font-semibold flex items-center gap-2 mb-3">
                <Icons.CogSettingsIcon />
                Generation Options
              </h2>

              {/* Batch Size Setting */}
              <div x-data="{ batchSize: 1 }">
                <div className="form-control">
                  <label className="label cursor-pointer">
                    <span className="label-text font-medium">Batch Size</span>
                    <output
                      for="batch_size_range"
                      className="label-text-alt text-primary font-bold text-lg px-2 py-1 min-w-[2.5rem] text-center"
                      x-text="batchSize"
                    ></output>
                  </label>
                  <input
                    id="batch_size_range"
                    type="range"
                    name="batch_size"
                    value={1}
                    min={1}
                    max={5}
                    step={1}
                    className="range range-primary w-full"
                    x-model="batchSize"
                  />
                  <div className="flex justify-between text-xs text-base-content/50 mt-1">
                    <span>1 image</span>
                    <span>5 images</span>
                  </div>
                </div>

                {/* Resolution Dropdown */}
                <div className="form-control mt-2">
                  <label className="label cursor-pointer">
                    <span className="label-text font-medium flex items-center gap-2">
                      <Icons.SquaresGridIcon />
                      Resolution
                    </span>
                  </label>
                  <select
                    name="resolution"
                    className="select select-bordered w-full flex-none"
                  >
                    <option value="480p">480p</option>
                    <option value="720p">720p</option>
                    <option value="1080p">1080p</option>
                    <option value="9_16_SD">9:16 (SD)</option>
                    <option value="9_16_HD">9:16 (HD)</option>
                  </select>
                </div>
              </div>

              {/* Style Preset Dropdown */}
              <div className="form-control mt-2 flex-none">
                <label className="label cursor-pointer">
                  <span className="label-text font-medium flex items-center gap-2">
                    <Icons.PaintBrushIcon />
                    Style Preset
                  </span>
                </label>
                <select
                  name="style_preset"
                  className="select select-bordered w-full flex-none"
                >
                  <option value="system">Default</option>
                  <option value="watercolor">Watercolor</option>
                  <option value="pencil_watercolor">Pencil Watercolor</option>
                </select>
              </div>
            </div>
          </div>

          {/* Card 4: Action Buttons */}
          <div className="card bg-base-100 shadow-xl w-auto min-w-[200px] flex-none flex flex-col">
            <div className="card-body flex flex-col p-4">
              <h2 className="card-title text-lg font-semibold flex items-center gap-2 mb-3 flex-none">
                <Icons.LightningBoltIcon />
                Generate Image
              </h2>
              <p className="text-sm text-base-content/70 mb-4 flex-none">
                Submit your prompt to generate images with the selected
                settings.
              </p>
              <div className="card-actions justify-between flex flex-row gap-2 mt-auto">
                <button type="reset" className="btn btn-ghost">
                  Reset
                </button>
                <button
                  type="submit"
                  id="submit-btn"
                  className="btn btn-primary"
                >
                  Generate
                  <span className="loading loading-spinner loading-md ml-2 hidden htmx-indicator"></span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Card 5: Job Progress - only shown when showProgress=true */}
        {showProgress && jobId ? (
          <div className="card bg-base-100 shadow-xl w-full max-h-[calc(40vh-3rem)] scrollbar-hide overflow-y-scroll flex-none flex flex-col">
            <div className="card-body flex flex-col p-4">
              <h2 className="card-title text-lg font-semibold flex items-center gap-2 mb-3">
                <Icons.PulseWavesIcon />
                Job Progress
              </h2>
              <p className="text-sm text-base-content/70 mb-4 flex-none">
                Monitoring job: {jobId}
              </p>

              {/* Events polling — HTMX fetches events which include NewImagePrompt with image metadata */}
              <div
                id="events-container"
                className="flex-grow"
                hx-get={`/jobs/events?job_id=${jobId}`}
                hx-trigger="load, every 2s"
                hx-swap="innerHTML"
              >
                <span className="loading loading-spinner"></span>
                Loading events...
              </div>

              {/* View Job Button Section */}
              <div className="card-actions justify-end mt-4 flex-none">
                <a
                  href={`/jobs?job_id=${jobId}&filter=all&tab=status`}
                  className="btn btn-primary"
                >
                  View Job
                </a>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Right column: Generated Image - Full height dedicated column */}
      {showProgress && jobId ? (
        <div className="card bg-base-100 shadow-xl w-full max-h-[calc(100vh-7rem)] scrollbar-hide overflow-y-scroll xl:flex-1 flex-grow flex flex-col">
          <div className="card-body flex flex-col p-4">
            <h2 className="card-title text-lg font-semibold flex items-center gap-2 mb-3 flex-none">
              <Icons.PhotoCameraIcon />
              Generated Images
            </h2>
            <div
              id="generated-image-card"
              className="flex-grow"
              hx-get={`/jobs/generated-images?job_id=${jobId}`}
              hx-trigger="load, every 2s"
              hx-swap="innerHTML"
            >
              <span className="loading loading-spinner loading-lg"></span>
              <p className="text-sm text-base-content/50 mt-4">
                Waiting for generated images...
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Default placeholder - shown when no job is active */
        <div className="card bg-base-100 shadow-xl w-full xl:flex-1 flex-grow flex items-center justify-center">
          <div className="card-body text-center py-16">
            <Icons.PhotoCameraLarge />
            <h3 className="font-medium text-base-content/60">
              The image(s) will be shown here once they have been generated.
            </h3>
          </div>
        </div>
      )}
    </form>
  </div>
);
