import { Icons } from "../components/Icons";
export default function CreateAudio(){
  return (
    <div class="flex flex-col sm:px-6 py-6 gap-6 bg-base-200 min-h-full">
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <h2 class="card-title flex items-center gap-2"><Icons.Audio />Create Audio</h2>
          <form class="flex flex-col gap-4" onSubmit={(e)=>{e.preventDefault(); const fd=new FormData(e.currentTarget as HTMLFormElement); fetch("/api/jobs/audio",{method:"POST", body:fd}).then(()=>alert("Audio job submitted"))}}>
            <textarea name="lyrics" class="textarea textarea-bordered w-full min-h-[140px]" placeholder="Lyrics (leave empty for instrumental)..."></textarea>
            <label class="flex items-center gap-2"><input type="checkbox" name="instrumental_only" class="checkbox checkbox-sm"/> Instrumental only</label>
            <div class="grid grid-cols-3 gap-2">
              <label class="flex flex-col text-sm">BPM<input name="bpm" type="number" value="120" class="input input-bordered input-sm"/></label>
              <label class="flex flex-col text-sm">Key<input name="keyscale" value="C major" class="input input-bordered input-sm"/></label>
              <label class="flex flex-col text-sm">Duration<input name="duration" type="number" value="30" class="input input-bordered input-sm"/></label>
            </div>
            <button type="submit" class="btn btn-primary">Generate Song</button>
          </form>
        </div>
      </div>
      <div class="card bg-base-100 shadow-xl p-6"><h3 class="font-semibold">Progress</h3><p class="opacity-60 text-sm">No active job.</p></div>
    </div>
  );
}
