export const notSelected = () => {
  return (
    <div id="job-content-container" class="min-h-[500px]">
      <div
        hx-target="#job-content-container"
        hx-swap="innerHTML"
        class="text-center py-20 text-base-content/70"
      >
        <p>Select a job from the sidebar to view its details</p>
      </div>
    </div>
  );
};
