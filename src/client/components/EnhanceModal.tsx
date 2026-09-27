import { Show } from "solid-js";

export type EnhanceModalProps = {
  open: boolean;
  original: string;
  enhanced: string;
  loading: boolean;
  error: string;
  onAccept: () => void;
  onRetry: () => void;
  onClose: () => void;
};

export default function EnhanceModal(props: EnhanceModalProps) {
  return (
    <Show when={props.open}>
      <div class="modal modal-open">
        <div class="modal-box max-w-2xl">
          <h3 class="font-bold text-lg">AI Enhance</h3>
          <label class="label">
            <span class="label-text">Original</span>
          </label>
          <textarea class="textarea textarea-bordered w-full" rows={3} readonly value={props.original} />
          <label class="label">
            <span class="label-text">Enhanced</span>
          </label>
          <Show when={props.loading}>
            <div class="flex justify-center py-4">
              <span class="loading loading-spinner loading-md" />
            </div>
          </Show>
          <Show when={!props.loading}>
            <textarea
              class="textarea textarea-bordered textarea-primary w-full"
              rows={8}
              readonly
              value={props.enhanced}
            />
          </Show>
          <Show when={props.error}>
            <div class="alert alert-error mt-2">
              <span>{props.error}</span>
            </div>
          </Show>
          <div class="modal-action">
            <button type="button" class="btn btn-ghost" onClick={props.onClose}>
              Cancel
            </button>
            <button
              type="button"
              class="btn btn-secondary"
              disabled={props.loading}
              onClick={props.onRetry}
            >
              Retry
            </button>
            <button
              type="button"
              class="btn btn-primary"
              disabled={props.loading || !!props.error || !props.enhanced}
              onClick={props.onAccept}
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
