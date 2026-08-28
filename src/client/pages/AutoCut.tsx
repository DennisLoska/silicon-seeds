import { Icons } from "../components/Icons";
export default function AutoCut(){
  return (
    <div class="flex flex-col sm:px-6 py-6 gap-6 bg-base-200 min-h-full">
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <h2 class="card-title flex items-center gap-2"><Icons.AutoCut />AutoCut</h2>
          <p class="opacity-60">Upload a video, transcribe with WhisperX, AI-remove filler/restarts/pauses, optionally insert AI clips.</p>
          <form class="flex flex-col gap-4" onSubmit={(e)=>{e.preventDefault(); const fd=new FormData(e.currentTarget as HTMLFormElement); fetch("/api/jobs/videos/autocut",{method:"POST", body:fd}).then(()=>alert("AutoCut submitted"))}}>
            <input type="file" name="video" accept="video/*" class="file-input file-input-bordered w-full" />
            <label class="flex items-center gap-2"><input type="checkbox" name="with_inserts" class="checkbox checkbox-sm"/> Insert AI clips</label>
            <button type="submit" class="btn btn-primary">Upload & Cut</button>
          </form>
        </div>
      </div>
      <div class="card bg-base-100 shadow-xl p-4"><h3 class="font-semibold">How it works</h3><ol class="list-decimal ml-6 text-sm opacity-70"><li>Upload video</li><li>Transcribe (WhisperX)</li><li>Analyze filler/restarts</li><li>Cut & render</li></ol></div>
    </div>
  );
}
