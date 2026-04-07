export const Compose = () => (
  <div className="flex flex-col items-start p-6 justify-center min-h-[400px]">
    <h2 className="text-3xl font-bold mb-4">1. Create a video script</h2>
    <p className="text-base-content/60">
      Start with a script for a video which will be used as the basis to
      generate images, audio and videos!
    </p>

    <textarea
      className="textarea textarea-ghost m-6 w-full lg:w-4xl min-h-[420px]"
      placeholder="Your video script..."
    ></textarea>
  </div>
);
