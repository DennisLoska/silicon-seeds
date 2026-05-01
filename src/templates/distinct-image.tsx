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
      {/* Card 1: Prompt Input - Takes half width and full height */}
      <div className="card bg-base-100 shadow-xl w-full xl:w-1/2 2xl:w-1/3 flex flex-col overflow-hidden">
        <div className="card-body flex flex-col flex-grow p-4">
          <h2 className="card-title text-lg font-semibold flex items-center gap-2 mb-3 flex-none">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 .621.504 1.125 1.125 1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-4.5c0-.621.504-1.125 1.125-1.125h3.75"
              />
            </svg>
            Prompt
          </h2>
          <textarea
            name="prompt"
            className="textarea textarea-ghost w-full flex-grow resize-none mb-4 min-h-[420px] focus:outline-none"
            placeholder="Describe the image you want to generate..."
          ></textarea>

          {/* Divider */}
          <div className="divider my-2 flex-none">OR</div>

          {/* File upload input (future feature) */}
          <input
            type="file"
            name="prompt_file"
            accept=".txt,.md"
            className="file-input file-input-bordered w-full flex-none opacity-50 cursor-not-allowed"
            disabled
          />
        </div>
      </div>

      {/* Container for Cards 2-5 - Stacked vertically, takes half width and full height */}
      <div className="flex flex-col w-full xl:w-1/2 gap-4 flex-grow">
        {/* Card 2: AI Model Selection */}
        <div className="card bg-base-100 shadow-xl w-full 2xl:w-[calc(12.5vw)] 2xl:min-w-80 flex-grow flex flex-col">
          <div className="card-body flex flex-col flex-grow">
            <h2 className="card-title text-lg font-semibold flex items-center gap-2 mb-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
                />
              </svg>
              AI Model
            </h2>

            {/* Image Model Selection */}
            <div className="form-control flex-grow">
              <label className="label cursor-pointer">
                <span className="label-text font-medium flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-5 h-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                    />
                  </svg>
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
        <div className="card bg-base-100 shadow-xl w-full 2xl:w-[calc(12.5vw)] 2xl:min-w-80 flex-grow flex flex-col">
          <div className="card-body flex flex-col flex-grow">
            <h2 className="card-title text-lg font-semibold flex items-center gap-2 mb-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
                />
              </svg>
              Generation Options
            </h2>

            {/* Batch Size Setting */}
            <div x-data="{ batchSize: 1 }" className="flex flex-col flex-grow">
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
              <div className="form-control mt-2 flex-grow">
                <label className="label cursor-pointer">
                  <span className="label-text font-medium flex items-center gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z"
                      />
                    </svg>
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
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-5 h-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42"
                    />
                  </svg>
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
        <div className="card bg-base-100 shadow-xl w-full 2xl:max-w-[calc(12.5vw)] 2xl:min-w-80 min-w-0 flex-grow flex flex-col">
          <div className="card-body flex flex-col flex-grow">
            <h2 className="card-title text-lg font-semibold flex items-center gap-2 mb-3 flex-none">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
                />
              </svg>
              Generate Image
            </h2>
            <p className="text-sm text-base-content/70 mb-4 flex-none">
              Submit your prompt to generate images with the selected settings.
            </p>
            <div className="card-actions justify-between flex flex-row gap-2 mt-auto">
              <button type="reset" className="btn btn-ghost">
                Reset
              </button>
              <button type="submit" id="submit-btn" className="btn btn-primary">
                Generate
                <span className="loading loading-spinner loading-md ml-2 hidden htmx-indicator"></span>
              </button>
            </div>
          </div>
        </div>

        {/* Card 5: Progress - Only shown when showProgress=true and jobId is provided */}
        {showProgress && jobId ? (
          <div className="card bg-base-100 shadow-xl w-full max-h-[calc(100vh-7rem)] scrollbar-hide overflow-y-scroll xl:w-1/2 2xl:w-1/3 flex flex-col">
            <div className="card-body flex flex-col">
              <h2 className="card-title text-lg font-semibold flex items-center gap-2 mb-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-6 h-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23-.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
                  />
                </svg>
                Job Progress
              </h2>
              <p className="text-sm text-base-content/70 mb-4 flex-none">
                Monitoring job: {jobId}
              </p>

              {/* Events polling — HTMX fetches events which include NewImagePrompt with image metadata */}
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
        ) : null}
      </div>

      {/* Card 6: Generated Image - Dedicated right column */}
      {showProgress && jobId ? (
        <div className="card bg-base-100 shadow-xl w-full xl:w-1/2 2xl:w-1/3 flex-grow flex flex-col">
          <div className="card-body flex flex-col">
            <h2 className="card-title text-lg font-semibold flex items-center gap-2 mb-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                />
              </svg>
              Generated Image
            </h2>
            <div
              id="generated-image-card"
              className="flex-grow flex items-center justify-center"
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
        <div className="card bg-base-100 shadow-xl w-full xl:w-1/2 2xl:w-1/3 flex-grow flex items-center justify-center">
          <div className="card-body text-center py-16">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-16 h-16 mx-auto mb-4 text-base-content/30"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
              />
            </svg>
            <h3 className="font-medium text-base-content/60">
              Enter a prompt and click Generate
            </h3>
          </div>
        </div>
      )}
    </form>
  </div>
);
