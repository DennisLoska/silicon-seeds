import { Icons } from "./icons";
import { ErrorToast } from "./toast";

interface ComposeProps {
  showProgress?: boolean;
  jobId?: string;
}

export const Compose = ({ showProgress = false, jobId = "" }: ComposeProps) => (
  <div className="flex flex-col sm:px-6 py-6 xl:h-full bg-base-200">
    <ErrorToast />
    {/* Kanban-style Card Container */}
    <form
      className="flex flex-col xl:flex-row gap-4 xl:h-full"
      hx-post="/api/jobs/videos/compose"
      hx-encoding="multipart/form-data"
      hx-swap="none"
      hx-disable-element="#submit-btn"
      hx-on={`
        before-request(this) {
          this.querySelector('.submit-toggle').checked = true;
        }
        after-request(this) {
          this.querySelector('.submit-toggle').checked = false;
        }
      `}
    >
      {/* Card 1: Video Script Input - Takes half width and full height */}
      <div className="card bg-base-100 shadow-xl w-full xl:w-1/2 2xl:w-1/3 flex flex-col overflow-hidden resize-none 2xl:resize-x 2xl:min-w-[500px]">
        <div className="card-body flex flex-col flex-grow p-4">
          <h2 className="card-title text-lg font-semibold flex items-center gap-2 mb-3 flex-none">
              <Icons.DocumentIcon />
            Video Script
          </h2>
          <textarea
            name="script"
            id="type-script-tab"
            className="textarea textarea-ghost w-full flex-grow resize-none mb-4 min-h-[420px] focus:outline-none"
            placeholder="Write your video script here..."
          ></textarea>

          {/* Divider */}
          <div className="divider my-2 flex-none">OR</div>

          {/* File upload input */}
          <input
            type="file"
            name="script_file"
            accept=".txt,.md"
            className="file-input file-input-bordered w-full flex-none"
          />
        </div>
      </div>

      {/* Container for Cards 2-4 - Stacked vertically, takes half width and full height */}
      <div className="flex flex-col w-full xl:w-1/2 gap-4 flex-grow">
        {/* Card 2: AI Model Selection */}
        <div className="card bg-base-100 shadow-xl w-full 2xl:w-[calc(12.5vw)] 2xl:min-w-80 flex-grow flex flex-col">
          <div className="card-body flex flex-col flex-grow">
            <h2 className="card-title text-lg font-semibold flex items-center gap-2 mb-3">
              <Icons.SparkleIcon />
              AI Models
            </h2>

            {/* Image Model Selection */}
            <div className="form-control flex-grow">
              <label className="label cursor-pointer">
                <span className="label-text font-medium flex items-center gap-2">
                  <Icons.PhotoCameraSmall />
                  Image Generation Model
                </span>
              </label>
              <select
                name="image_model"
                className="select select-bordered w-full"
              >
                <option value="z-image-turbo">Z-Image-Turbo</option>
              </select>
            </div>

            {/* Video Model Selection */}
            <div className="form-control flex-grow">
              <label className="label cursor-pointer">
                <span className="label-text font-medium flex items-center gap-2">
                  <Icons.VideoCameraSmall />
                  Video Generation Model
                </span>
              </label>
              <select
                name="video_model"
                className="select select-bordered w-full"
              >
                <option value="wan2.2">Wan2.2</option>
              </select>
            </div>
          </div>
        </div>

        {/* Card 3: Video Settings */}
        <div className="card bg-base-100 shadow-xl w-full 2xl:max-w-[calc(12.5vw)] 2xl:min-w-80 min-w-0 flex-grow flex flex-col">
          <div className="card-body flex flex-col flex-grow">
            <h2 className="card-title text-lg font-semibold flex items-center gap-2 mb-3">
              <Icons.CogSettingsIcon />
              Video Settings
            </h2>

            <div
              x-data="{ fps: 16, clipDuration: 5, transitionDuration: 3, resolution: '480p' }"
              className="flex flex-col flex-grow"
            >
              {/* FPS Setting */}
              <div className="form-control flex-grow">
                <label className="label cursor-pointer">
                  <span className="label-text font-medium">
                    Frames Per Second (FPS)
                  </span>
                  <output
                    for="fps_range"
                    className="label-text-alt text-primary font-bold text-lg px-2 py-1 min-w-[2.5rem] text-center"
                    x-text="fps"
                  ></output>
                </label>
                <input
                  id="fps_range"
                  type="range"
                  name="fps"
                  value="16"
                  min="1"
                  max="24"
                  step="1"
                  className="range range-primary w-full"
                  x-model="fps"
                />
                <div className="flex justify-between text-xs text-base-content/50 mt-1">
                  <span>1 FPS</span>
                  <span>24 FPS</span>
                </div>
              </div>

              {/* Clip Duration Setting */}
              <div className="form-control flex-grow">
                <label className="label cursor-pointer">
                  <span className="label-text font-medium">Clip Duration</span>
                  <output
                    for="clip_duration_range"
                    className="label-text-alt text-secondary font-bold text-lg px-2 py-1 min-w-[2.5rem] text-center"
                    x-text="clipDuration + 's'"
                  ></output>
                </label>
                <input
                  id="clip_duration_range"
                  type="range"
                  name="clip_duration"
                  value="5"
                  min="1"
                  max="10"
                  step="1"
                  className="range range-secondary w-full"
                  x-model="clipDuration"
                />
                <div className="flex justify-between text-xs text-base-content/50 mt-1">
                  <span>1 sec</span>
                  <span>10 secs</span>
                </div>
              </div>

              {/* Transition Duration Setting */}
              <div className="form-control flex-grow">
                <label className="label cursor-pointer">
                  <span className="label-text font-medium">
                    Transition Duration
                  </span>
                  <output
                    for="transition_duration_range"
                    className="label-text-alt text-accent font-bold text-lg px-2 py-1 min-w-[2.5rem] text-center"
                    x-text="transitionDuration + 's'"
                  ></output>
                </label>
                <input
                  id="transition_duration_range"
                  type="range"
                  name="transition_duration"
                  value="3"
                  min="1"
                  max="10"
                  step="1"
                  className="range range-accent w-full"
                  x-model="transitionDuration"
                />
                <div className="flex justify-between text-xs text-base-content/50 mt-1">
                  <span>1 sec</span>
                  <span>10 secs</span>
                </div>
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
        </div>

        {/* Card 4: Style Presets */}
        <div className="card bg-base-100 shadow-xl w-full 2xl:max-w-[calc(12.5vw)] 2xl:min-w-80 min-w-0 flex-grow flex flex-col">
          <div className="card-body flex flex-col">
            <h2 className="card-title text-lg font-semibold flex items-center gap-2 mb-3">
              <Icons.PaintBrushLarge />
              Style Preset
            </h2>
            <div className="form-control">
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

        {/* Card 5: Action Buttons */}
        <div className="card bg-base-100 shadow-xl w-full 2xl:max-w-[calc(12.5vw)] 2xl:min-w-80 min-w-0 flex-grow flex flex-col">
          <div className="card-body flex flex-col flex-grow">
            <h2 className="card-title text-lg font-semibold flex items-center gap-2 mb-3 flex-none">
              <Icons.LightningBoltIcon />
              Action!
            </h2>
            <p className="text-sm text-base-content/70 mb-4 flex-none">
              Schedule the job to generate the video with the selected settings.
            </p>
            <div className="card-actions justify-between flex flex-row gap-2 mt-auto">
              <button type="reset" className="btn btn-ghost">
                Reset
              </button>
              <button type="submit" id="submit-btn" className="btn btn-primary">
                Generate Video
                <span className="loading loading-spinner loading-md ml-2 hidden htmx-indicator"></span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Card 6: Progress - Only shown when showProgress=true */}
      {showProgress && jobId && (
        <div className="card bg-base-100 shadow-xl w-full max-h-[calc(100vh-7rem)] scrollbar-hide overflow-y-scroll xl:w-1/2 2xl:w-1/3 flex flex-col">
          <div className="card-body flex flex-col">
            <h2 className="card-title text-lg font-semibold flex items-center gap-2 mb-3">
              <Icons.PulseWavesIcon />
              Job Progress
            </h2>
            <p className="text-sm text-base-content/70 mb-4 flex-none">
              Monitoring job: {jobId}
            </p>
            <div
              id="events-container"
              className="flex-grow min-h-[300px]"
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
      )}
    </form>
  </div>
);
