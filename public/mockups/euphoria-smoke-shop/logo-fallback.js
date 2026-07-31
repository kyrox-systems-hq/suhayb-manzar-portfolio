document.querySelectorAll(".brand-logo").forEach((logo) => {
  const showFallback = () => {
    logo.hidden = true;
    if (logo.nextElementSibling) logo.nextElementSibling.hidden = false;
  };

  logo.addEventListener("error", showFallback);
  if (logo.complete && logo.naturalWidth === 0) showFallback();
});
