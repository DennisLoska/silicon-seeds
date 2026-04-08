export const Compose = () => (
  <div className="flex flex-col p-6 h-full bg-base-200">
    {/* Kanban-style Card Container */}
    <form
      className="flex flex-col xl:flex-row gap-4 h-full"
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
      <div className="card bg-base-100 shadow-xl w-full xl:w-1/2 flex flex-col">
        <div className="card-body flex flex-col flex-grow p-4">
          <h2 className="card-title text-lg font-semibold flex items-center gap-2 mb-3 flex-none">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
              />
            </svg>
            Video Script
          </h2>
          <p className="text-sm text-base-content/70 mb-4 flex-none">
            Provide your video script by typing it below or uploading a text file.
          </p>

          {/* Textarea for typing script */}
          <textarea
            name="script"
            id="type-script-tab"
            className="textarea textarea-bordered w-full flex-grow resize-none mb-4"
            placeholder="Write your video script here...\n\nDescribe scenes, dialogue, and visual elements that you want to appear in your video. Be as detailed as possible for better results!"
          ></textarea>

          {/* Divider */}
          <div className="divider my-2 flex-none">OR</div>

          {/* File upload input */}
          <input
            type="file"
            name="script_file"
            accept=".txt,.md,.json"
            className="file-input file-input-bordered w-full flex-none"
          />
        </div>
      </div>

      {/* Container for Cards 2-4 - Stacked vertically, takes half width and full height */}
      <div className="flex flex-col w-full xl:w-1/2 gap-4 flex-grow">
        {/* Card 2: AI Model Selection */}
        <div className="card bg-base-100 shadow-xl w-full xl:max-w-[calc(25vw)] min-w-0 flex-grow">
          <div className="card-body">
            <h2 className="card-title text-lg font-semibold flex items-center gap-2 mb-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
                />
              </svg>
              AI Models
            </h2>
            <p className="text-sm text-base-content/70 mb-4">
              Select the AI models you want to use for generating images and videos.
            </p>

            {/* Image Model Selection */}
            <div className="form-control mb-4">
              <label className="label cursor-pointer">
                <span className="label-text font-medium flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    className="w-5 h-5"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                    />
                  </svg>
                  Image Generation Model
                </span>
              </label>
              <select name="image_model" className="select select-bordered w-full">
                <option value="">Select an image model</option>
                <option value="flux-dev">Flux Dev</option>
                <option value="flux-pro">Flux Pro</option>
                <option value="stable-diffusion-xl">Stable Diffusion XL</option>
                <option value="stable-diffusion-3">Stable Diffusion 3</option>
                <option value="dall-e-3">DALL-E 3</option>
                <option value="midjourney-v6">Midjourney v6</option>
              </select>
            </div>

            {/* Video Model Selection */}
            <div className="form-control">
              <label className="label cursor-pointer">
                <span className="label-text font-medium flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    className="w-5 h-5"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
                    />
                  </svg>
                  Video Generation Model
                </span>
              </label>
              <select name="video_model" className="select select-bordered w-full">
                <option value="">Select a video model</option>
                <option value="sora">Sora</option>
                <option value="runway-gen-3">Runway Gen-3</option>
                <option value="pika-labs">Pika Labs</option>
                <option value="stable-video-diffusion">
                  Stable Video Diffusion
                </option>
                <option value="kling">Kling</option>
              </select>
            </div>
          </div>
        </div>

        {/* Card 3: Video Settings */}
        <div className="card bg-base-100 shadow-xl w-full xl:max-w-[calc(25vw)] min-w-0 flex-grow flex flex-col">
          <div className="card-body flex flex-col flex-grow">
            <h2 className="card-title text-lg font-semibold flex items-center gap-2 mb-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                />
               </svg>
               Video Settings
             </h2>
             <p className="text-sm text-base-content/70 mb-4 flex-none">
              Configure the technical parameters for your video generation.
            </p>

            <div x-data="{ fps: 16, clipDuration: 5, transitionDuration: 3 }" className="flex flex-col flex-grow">
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
                  <span className="label-text font-medium">Transition Duration</span>
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
          </div>
        </div>

        {/* Card 4: Style Presets */}
        <div className="card bg-base-100 shadow-xl w-full xl:max-w-[calc(25vw)] min-w-0 flex-grow">
          <div className="card-body">
            <h2 className="card-title text-lg font-semibold flex items-center gap-2 mb-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42"
                />
              </svg>
              Style Preset
            </h2>
            <p className="text-sm text-base-content/70 mb-4">
              Choose a visual style preset for your video.
            </p>
            <select
              name="style_preset"
              className="select select-bordered w-full"
            >
              <option value="system">Default</option>
              <option value="watercolor">Watercolor</option>
              <option value="pencil_watercolor">Pencil Watercolor</option>
              <option value="cinematic">Cinematic</option>
              <option value="anime">Anime</option>
              <option value="realistic">Realistic</option>
              <option value="cartoon">Cartoon</option>
              <option value="painting">Painting</option>
              <option value="3d-model">3D Model</option>
              <option value="sketch">Sketch</option>
              <option value="cyberpunk">Cyberpunk</option>
            </select>

            {/* Action Buttons */}
            <div className="card-actions justify-end flex flex-row gap-2 mt-6">
              <button type="reset" className="btn btn-ghost">
                Reset
              </button>
              <button
                type="submit"
                id="submit-btn"
                className="btn btn-primary"
              >
                Generate Video
                <span className="loading loading-spinner loading-md htmx-indicator ml-2"></span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  </div>
);
