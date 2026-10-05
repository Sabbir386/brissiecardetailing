let locked = false;
let scrollY = 0;

function applyLock() {
  const html = document.documentElement;
  const body = document.body;
  scrollY = window.scrollY;
  html.style.scrollBehavior = "auto";
  html.classList.add("scroll-locked");
  body.style.position = "fixed";
  body.style.top = `-${scrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  body.style.overflow = "hidden";
}

function releaseLock() {
  const html = document.documentElement;
  const body = document.body;
  html.classList.remove("scroll-locked");
  body.style.position = "";
  body.style.top = "";
  body.style.left = "";
  body.style.right = "";
  body.style.width = "";
  body.style.overflow = "";
  window.scrollTo(0, scrollY);
  html.style.scrollBehavior = "";
}

export function setScrollLocked(next: boolean) {
  if (typeof document === "undefined" || next === locked) return;
  locked = next;
  if (next) applyLock();
  else releaseLock();
}
