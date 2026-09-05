/** An original console-style ident, kept outside the game DOM so renders cannot restart it. */
export function studioIntro(reduced: boolean, onGesture: () => void) {
  document.querySelector(".studio-boot")?.remove();
  const app = document.querySelector<HTMLElement>("#app")!;
  const previousFocus = document.activeElement as HTMLElement | null;
  app.inert = true;
  const root = document.createElement("div");
  root.className = `studio-boot ${reduced ? "still" : ""}`;
  root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "co-created by Dakota Rain Lock with GPT Astra and Rook");
  root.innerHTML = `<div class="boot-horizon"></div><div class="boot-stars"></div><div class="boot-core" aria-hidden="true"><i></i><i></i><i></i><b>✦</b></div><div class="boot-credit"><span>co-created by</span><strong>Dakota Rain Lock</strong><em>with</em><strong>GPT Astra</strong><em>&</em><strong>Rook</strong></div><button class="boot-skip" type="button">Tap to begin <span>♪ Sound on your first tap</span></button>`;
  document.body.append(root);
  let done = false;
  const finish = (gesture = false) => {
    if (done) return;
    done = true; clearTimeout(timer);
    if (gesture) onGesture();
    root.classList.add("leaving");
    setTimeout(() => {root.remove(); app.inert = false; if (previousFocus?.isConnected) previousFocus.focus();}, reduced ? 0 : 450);
  };
  const timer = window.setTimeout(() => finish(), reduced ? 2800 : 6400);
  root.querySelector("button")!.addEventListener("click", () => finish(true));
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {event.preventDefault(); finish(true);}
    if (event.key === "Tab") {event.preventDefault(); root.querySelector("button")!.focus();}
  });
  root.querySelector("button")!.focus();
}
