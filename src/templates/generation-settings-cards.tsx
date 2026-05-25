import { Metadata } from "../meta/meta";
import { Presets } from "../styles/presets";
import { Icons } from "./icons";

const SHARED_CARD_CLASS = "card bg-base-100 shadow-xl w-full 2xl:max-w-[calc(12.5vw)] 2xl:min-w-80 min-w-0 flex-grow flex flex-col";
const MODEL_CARD_CLASS = "card bg-base-100 shadow-xl w-full 2xl:w-[calc(12.5vw)] 2xl:min-w-80 flex-grow flex flex-col";

function mergeClassName(baseClassName: string, className?: string) {
  return className ? `${baseClassName} ${className}` : baseClassName;
}

export const DEFAULT_GENERATION_SETTINGS = {
  imageModel: "z-image-turbo",
  videoModel: "wan2.2",
  fps: Metadata.FPS,
  clipDuration: Metadata.CLIP_DURATION,
  transitionDuration: Metadata.TRANSITION_DURATION,
  resolution: "480p",
  stylePreset: Presets.SYSTEM,
} as const;

interface CardProps {
  className?: string;
  disabled?: boolean;
  disabledExpr?: string;
  showExpr?: string;
}

function disabledAttrs(disabled: boolean, disabledExpr?: string) {
  return {
    disabled,
    "x-bind:disabled": disabledExpr,
  };
}

export function AIModelsCard({
  className = MODEL_CARD_CLASS,
  disabled = false,
  disabledExpr,
  showExpr,
}: CardProps) {
  return (
    <div className={mergeClassName(MODEL_CARD_CLASS, className === MODEL_CARD_CLASS ? undefined : className)} x-show={showExpr}>
      <div className="card-body flex flex-col flex-grow">
        <h2 className="card-title text-lg font-semibold flex items-center gap-2 mb-3">
          <Icons.SparkleIcon />
          AI Models
        </h2>

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
            {...disabledAttrs(disabled, disabledExpr)}
          >
            <option value={DEFAULT_GENERATION_SETTINGS.imageModel}>Z-Image-Turbo</option>
          </select>
        </div>

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
            {...disabledAttrs(disabled, disabledExpr)}
          >
            <option value="wan2.2">Wan 2.2</option>
            <option value="ltx2.3">LTX 2.3</option>
          </select>
        </div>
      </div>
    </div>
  );
}

export function VideoSettingsCard({
  className = SHARED_CARD_CLASS,
  disabled = false,
  disabledExpr,
  showExpr,
}: CardProps) {
  return (
    <div className={mergeClassName(SHARED_CARD_CLASS, className === SHARED_CARD_CLASS ? undefined : className)} x-show={showExpr}>
      <div className="card-body flex flex-col flex-grow">
        <h2 className="card-title text-lg font-semibold flex items-center gap-2 mb-3">
          <Icons.CogSettingsIcon />
          Video Settings
        </h2>

        <div
          x-data={`{ fps: ${DEFAULT_GENERATION_SETTINGS.fps}, clipDuration: ${DEFAULT_GENERATION_SETTINGS.clipDuration}, transitionDuration: ${DEFAULT_GENERATION_SETTINGS.transitionDuration}, resolution: '${DEFAULT_GENERATION_SETTINGS.resolution}' }`}
          className="flex flex-col flex-grow"
        >
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
              value={String(DEFAULT_GENERATION_SETTINGS.fps)}
              min="1"
              max="24"
              step="1"
              className="range range-primary w-full"
              x-model="fps"
              {...disabledAttrs(disabled, disabledExpr)}
            />
            <div className="flex justify-between text-xs text-base-content/50 mt-1">
              <span>1 FPS</span>
              <span>24 FPS</span>
            </div>
          </div>

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
              value={String(DEFAULT_GENERATION_SETTINGS.clipDuration)}
              min="1"
              max="10"
              step="1"
              className="range range-secondary w-full"
              x-model="clipDuration"
              {...disabledAttrs(disabled, disabledExpr)}
            />
            <div className="flex justify-between text-xs text-base-content/50 mt-1">
              <span>1 sec</span>
              <span>10 secs</span>
            </div>
          </div>

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
              value={String(DEFAULT_GENERATION_SETTINGS.transitionDuration)}
              min="1"
              max="10"
              step="1"
              className="range range-accent w-full"
              x-model="transitionDuration"
              {...disabledAttrs(disabled, disabledExpr)}
            />
            <div className="flex justify-between text-xs text-base-content/50 mt-1">
              <span>1 sec</span>
              <span>10 secs</span>
            </div>
          </div>
        </div>

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
            {...disabledAttrs(disabled, disabledExpr)}
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
  );
}

export function StylePresetCard({
  className = SHARED_CARD_CLASS,
  disabled = false,
  disabledExpr,
  showExpr,
}: CardProps) {
  return (
    <div className={mergeClassName(SHARED_CARD_CLASS, className === SHARED_CARD_CLASS ? undefined : className)} x-show={showExpr}>
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
            {...disabledAttrs(disabled, disabledExpr)}
          >
            <option value={Presets.SYSTEM}>Default</option>
            <option value={Presets.WATERCOLOR}>Watercolor</option>
            <option value={Presets.PENCIL_WATERCOLOR}>Pencil Watercolor</option>
          </select>
        </div>
      </div>
    </div>
  );
}
