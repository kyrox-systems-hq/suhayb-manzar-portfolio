const preview = document.getElementById("mobile-preview");

function syncHeight() {
  const documentElement = preview.contentDocument?.documentElement;
  const body = preview.contentDocument?.body;
  if (!documentElement || !body) return;

  preview.style.height = `${Math.max(
    documentElement.scrollHeight,
    documentElement.offsetHeight,
    body.scrollHeight,
    body.offsetHeight,
  )}px`;
}

preview.addEventListener("load", () => {
  syncHeight();
  window.setInterval(syncHeight, 500);
});

window.addEventListener("resize", syncHeight);
