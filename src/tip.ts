/** Optional pay-what-you-want tip jar — home/title screen only. */
export const TIP_LINKS = {
  1: "https://donate.stripe.com/cNi5kF2oMd47c7AdCu9AA00",
  5: "https://donate.stripe.com/cNi6oJgfCc038Vo55Y9AA01",
  10: "https://donate.stripe.com/6oU3cx7J6fcfc7Acyq9AA02",
  custom: "https://donate.stripe.com/6oU3cx1kI2pt4F841U9AA03",
} as const;

export type TipAmount = 1 | 5 | 10 | "custom";

export function tipUrl(amount: TipAmount): string {
  return TIP_LINKS[amount];
}

export function openTip(amount: TipAmount): void {
  window.open(tipUrl(amount), "_blank", "noopener,noreferrer");
}

const STYLE_ID = "mesh-tip-jar-style";
const BTN_CLASS = "tip-jar-link";

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
.${BTN_CLASS}{
margin-top:10px;align-self:center;min-height:36px;min-width:0;padding:6px 12px;
border:1px solid var(--line,#343b4c);border-radius:999px;background:transparent;
color:var(--muted,#9a9488);font:inherit;font-size:12px;font-weight:600;
letter-spacing:.04em;opacity:.85;cursor:pointer;
}
.${BTN_CLASS}:hover,.${BTN_CLASS}:focus-visible{color:var(--gold,#d4b45a);border-color:#d4b45a66;opacity:1}
.tip-jar-backdrop{position:fixed;inset:0;z-index:40;background:#040a18b8;backdrop-filter:blur(9px);
display:flex;align-items:center;justify-content:center;padding:16px}
.tip-jar-modal{position:relative;max-width:420px;width:100%;padding:28px 22px 20px;border:1px solid #b3c3e06b;
border-radius:5px;background:linear-gradient(145deg,#233955fa,#0b182efa);color:var(--bone,#e6dece);
display:flex;flex-direction:column;gap:14px;box-shadow:0 24px 90px #0009}
.tip-jar-modal .eyebrow{font-size:10px;letter-spacing:.18em;color:var(--gold,#d4b45a);font-weight:700}
.tip-jar-modal h2{margin:0;font-size:22px}
.tip-jar-modal p{margin:0;color:#b5c6dc;font-size:13px;line-height:1.55}
.tip-jar-amounts{display:flex;flex-wrap:wrap;gap:8px}
.tip-jar-amounts button{flex:1 1 64px;min-height:44px;border:1px solid var(--line,#343b4c);border-radius:10px;
background:var(--panel2,#262c3a);color:var(--bone,#e6dece);font:inherit;font-weight:650;cursor:pointer}
.tip-jar-amounts button:hover{border-color:var(--gold,#d4b45a);color:var(--gold,#d4b45a)}
.tip-jar-skip,.tip-jar-close{min-height:40px;border:0;background:transparent;color:#a9c0db;font:inherit;cursor:pointer}
.tip-jar-close{position:absolute;top:8px;right:10px;font-size:18px;line-height:1}
.tip-jar-note{font-size:11px;opacity:.85}
`;
  document.head.appendChild(style);
}

function closeTipModal(): void {
  document.getElementById("tip-jar-root")?.remove();
}

function openTipModal(): void {
  closeTipModal();
  const root = document.createElement("div");
  root.id = "tip-jar-root";
  root.innerHTML = `
<div class="tip-jar-backdrop" role="presentation">
  <section class="tip-jar-modal" role="dialog" aria-modal="true" aria-label="Tip the developer">
    <button type="button" class="tip-jar-close" aria-label="Close">×</button>
    <div class="eyebrow">OPTIONAL · PAY WHAT YOU WANT</div>
    <h2>Tip the developer</h2>
    <p>Pay what you think is fair — or skip. Game stays free.</p>
    <div class="tip-jar-amounts">
      <button type="button" data-tip="1">$1</button>
      <button type="button" data-tip="5">$5</button>
      <button type="button" data-tip="10">$10</button>
      <button type="button" data-tip="custom">Other</button>
    </div>
    <p class="tip-jar-note">Other opens Stripe where you can enter any amount. Never required to play.</p>
    <button type="button" class="tip-jar-skip">Maybe later</button>
  </section>
</div>`;
  document.body.appendChild(root);
  root.querySelector(".tip-jar-backdrop")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeTipModal();
  });
  root.querySelector(".tip-jar-close")?.addEventListener("click", closeTipModal);
  root.querySelector(".tip-jar-skip")?.addEventListener("click", closeTipModal);
  root.querySelectorAll<HTMLButtonElement>("[data-tip]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const raw = btn.dataset.tip || "custom";
      const amount = (raw === "1" || raw === "5" || raw === "10" ? Number(raw) : "custom") as TipAmount;
      openTip(amount);
    });
  });
}

function syncTipControl(): void {
  ensureStyles();
  const title = document.querySelector(".play-layout.title-screen .title-menu");
  const existing = document.querySelector(`.${BTN_CLASS}`);
  // Mid-run / combat / map: remove if somehow present
  if (!title) {
    existing?.remove();
    closeTipModal();
    return;
  }
  if (existing) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = BTN_CLASS;
  btn.setAttribute("aria-label", "Tip the developer");
  btn.textContent = "Tip the developer";
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openTipModal();
  });
  title.appendChild(btn);
}

function bootTipJar(): void {
  const app = document.getElementById("app");
  if (!app) return;
  syncTipControl();
  const obs = new MutationObserver(() => syncTipControl());
  obs.observe(app, { childList: true, subtree: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootTipJar);
} else {
  bootTipJar();
}
