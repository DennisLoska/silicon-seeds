import { Icons } from "../components/Icons";
export default function CreateImage(){
  return (
    <div class="flex flex-col sm:px-6 py-6 gap-6 bg-base-200 min-h-full">
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <h2 class="card-title flex items-center gap-2"><Icons.PhotoCameraIcon />Create Image</h2>
          <form class="flex flex-col gap-4" onSubmit={(e)=>{e.preventDefault(); const fd=new FormData(e.currentTarget as HTMLFormElement); fetch("/api/jobs/images",{method:"POST", body:fd}).then(()=>alert("Image job submitted"))}}>
            <textarea name="prompt" class="textarea textarea-bordered w-full min-h-[120px]" placeholder="A watercolor of ancient Egypt ..."></textarea>
            <div class="grid grid-cols-2 gap-4">
              <label class="flex flex-col text-sm">Width<input name="width" type="number" value="1024" class="input input-bordered input-sm"/></label>
              <label class="flex flex-col text-sm">Height<input name="height" type="number" value="1024" class="input input-bordered input-sm"/></label>
            </div>
            <button type="submit" class="btn btn-primary">Generate Image</button>
          </form>
        </div>
      </div>
      <div class="card bg-base-100 shadow-xl p-6"><h3 class="font-semibold flex items-center gap-2"><Icons.SparkleIcon />Progress</h3><p class="opacity-60 text-sm">No active job. Submit to see progress via SSE.</p></div>
    </div>
  );
}
