// Form submission handlers for video compose page

document.addEventListener("DOMContentLoaded", function () {
  const form = document.querySelector(
    'form[hx-post="/api/jobs/videos/compose"]',
  );

  if (!form) return;

  const submitBtn = form.querySelector("#submit-btn");
  const toastContainer = document.getElementById("error-toast-container");

  // Before request: disable button, clear any existing error toast
  form.addEventListener("htmx:beforeRequest", () => {
    submitBtn.disabled = true;
    clearErrorToast();
  });

  // After successful request: re-enable button
  form.addEventListener("htmx:afterRequest", () => {
    submitBtn.disabled = false;
  });

  // On error: re-enable button, hide spinner, and show error toast
  form.addEventListener("htmx:error", (event) => {
    submitBtn.disabled = false;
    const spinner = submitBtn.querySelector(".htmx-indicator");
    if (spinner) spinner.classList.add("hidden");

    const xhr = event.detail.xhr;
    let errorMessage = "An error occurred while processing your request.";

    if (xhr?.responseText) {
      try {
        const responseJson = JSON.parse(xhr.responseText);
        errorMessage =
          responseJson.error || responseJson.message || errorMessage;
      } catch {
        errorMessage = xhr.responseText;
      }
    }

    showErrorToast(errorMessage);
  });

  function showErrorToast(message) {
    if (!toastContainer) return;

    // Clear any existing toast
    clearErrorToast();

    // Show the container
    toastContainer.classList.remove("hidden");

    // Create alert element with daisyUI classes
    const alertElement = document.createElement("div");
    alertElement.className = "alert alert-error shadow-lg";
    alertElement.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="flex-shrink-0 w-6 h-6">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
      </svg>
      <span>${escapeHtml(message)}</span>
    `;

    toastContainer.appendChild(alertElement);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      alertElement.remove();
    }, 5000);
  }

  function clearErrorToast() {
    if (toastContainer) {
      toastContainer.innerHTML = "";
    }
  }

  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
});
