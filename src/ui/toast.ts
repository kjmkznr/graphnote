type ToastLevel = "error" | "warn" | "info" | "success";

const container = (() => {
  const el = document.createElement("div");
  el.id = "toast-container";
  document.addEventListener("DOMContentLoaded", () =>
    document.body.appendChild(el),
  );
  // If DOMContentLoaded already fired, append immediately
  if (document.readyState !== "loading") document.body.appendChild(el);
  return el;
})();

export function showToast(
  message: string,
  level: ToastLevel = "error",
  duration = 4000,
): void {
  const toast = document.createElement("div");
  toast.className = `toast toast-${level}`;
  toast.textContent = message;

  container.appendChild(toast);

  // Trigger fade-in
  requestAnimationFrame(() => toast.classList.add("toast-visible"));

  const remove = () => {
    toast.classList.remove("toast-visible");
    toast.addEventListener("transitionend", () => toast.remove(), {
      once: true,
    });
  };

  const timer = setTimeout(remove, duration);
  toast.addEventListener("click", () => {
    clearTimeout(timer);
    remove();
  });
}
