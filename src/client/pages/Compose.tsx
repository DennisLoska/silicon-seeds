import { Icons } from "../components/Icons";
export default function Compose(){
  return (
    <div class="flex flex-col sm:px-6 py-6 xl:h-full bg-base-200">
      <form class="flex flex-col xl:flex-row gap-4 xl:h-full" onSubmit={(e)=>{e.preventDefault(); const fd=new FormData(e.currentTarget as HTMLFormElement); fetch("/api/jobs/videos/compose",{method:"POST", body:fd}).then(()=>alert("Compose submitted"))}}>
        <div class="flex flex-col gap-4 w-full xl:w-1/2 2xl:w-1/3 2xl:min-w-[500px] xl:h-full min-h-0 overflow-hidden">
          <div class="card bg-base-100 shadow-xl flex flex-col overflow-hidden flex-1 min-h-0">
            <div class="card-body flex flex-col flex-grow p-4 min-h-0">
              <h2 class="card-title text-lg font-semibold flex items-center gap-2 mb-3"><Icons.DocumentIcon />Video Script</h2>
              <textarea name="script" class="textarea textarea-ghost w-full flex-grow resize-none mb-4 min-h-[420px] focus:outline-none" placeholder="Write your video script here..."></textarea>
              <div class="divider my-2">OR</div>
              <input type="file" name="script_file" accept=".txt,.md" class="file-input file-input-bordered w-full" />
            </div>
          </div>
          <div class="card bg-base-100 shadow-xl flex-none">
            <div class="card-body flex flex-col p-4">
              <h2 class="card-title text-lg font-semibold flex items-center gap-2 mb-3"><Icons.PaintBrushIcon />Style Guide</h2>
              <textarea name="style_guide" maxLength={2000} rows={7} style="min-height:180px;max-height:320px" class="textarea textarea-bordered w-full resize-y" placeholder="Define consistent style across all images..."></textarea>
              <p class="text-xs text-base-content/60 mt-2">Defines stylistic coherence across all generated images. Applied in addition to Style Preset.</p>
            </div>
          </div>
        </div>
        <div class="flex flex-col w-full xl:w-1/2 gap-4 flex-grow">
          <div class="card bg-base-100 shadow-xl p-4"><h3 class="card-title"><Icons.SparkleIcon />AI Models</h3><p class="opacity-60 text-sm">Model selection (stub)</p></div>
          <div class="card bg-base-100 shadow-xl p-4"><h3 class="card-title"><Icons.VideoCameraSmall />Video Settings</h3><div class="grid grid-cols-2 gap-2 text-sm"><label class="flex flex-col">FPS<input name="fps" type="number" value="24" class="input input-bordered input-sm"/></label><label class="flex flex-col">Clip Duration<input name="clip_duration" type="number" value="5" class="input input-bordered input-sm"/></label></div></div>
          <div class="card bg-base-100 shadow-xl p-4"><h3 class="card-title">Style Preset</h3><select name="style_preset" class="select select-bordered w-full"><option>System</option><option>Watercolor</option><option>Pencil</option></select></div>
          <div class="card bg-base-100 shadow-xl p-4"><h3 class="card-title"><Icons.MicIconSmall />Voice</h3><select name="voice" class="select select-bordered w-full"><option>Default</option></select></div>
          <div class="card bg-base-100 shadow-xl w-full 2xl:max-w-[calc(12.5vw)] 2xl:min-w-80 min-w-0 flex-grow flex flex-col">
            <div class="card-body flex flex-col h-full">
              <h2 class="card-title text-lg font-semibold flex items-center gap-2 mb-3"><Icons.LightningBoltIcon />Action!</h2>
              <div class="card-actions justify-between flex flex-row gap-2 mt-auto">
                <button type="reset" class="btn btn-ghost">Reset</button>
                <button type="submit" class="btn btn-primary">Generate Video<span class="loading loading-spinner loading-md ml-2 hidden"></span></button>
              </div>
            </div>
          </div>
        </div>
      </form>
      <dialog id="job-action-modal" class="modal"></dialog>
    </div>
  );
}
