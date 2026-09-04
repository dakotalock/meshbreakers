const paths: Record<string, string> = {
  sword: "m14 3 7 0 0 7-9 9-7-7 9-9ZM5 13l6 6M3 21l5-5M3 17l4 4",
  shield: "M12 3 21 7v5c0 5-9 9-9 9S3 17 3 12V7l9-4Z",
  bolt: "m13 2-9 12h7l-1 8 10-13h-7l0-7Z",
  crosshair: "M12 2v4m0 12v4M2 12h4m12 0h4M8 12a4 4 0 1 0 8 0 4 4 0 0 0-8 0Z",
  target:
    "M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0Zm5 0a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z",
  burst: "m12 2 2 7 7-4-4 7 5 3-8 1-2 6-2-7-7 4 4-7-5-3 8-1 2-6Z",
  star: "m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z",
  plus: "M12 4v16M4 12h16",
  heart: "M20 5c-3-3-7-1-8 1-1-2-5-4-8-1-4 4 1 10 8 15 7-5 12-11 8-15Z",
  hex: "m12 2 9 5v10l-9 5-9-5V7l9-5ZM8 8l8 8m0-8-8 8",
  chevrons: "m5 8 7-5 7 5M5 15l7-5 7 5M5 22l7-5 7 5",
  cup: "M4 4h12v10a6 6 0 0 1-12 0V4Zm12 2h3a3 3 0 0 1 0 6h-3M3 21h16",
  diamond: "m12 2 10 10-10 10L2 12 12 2Z",
  magnet: "M4 4v9a8 8 0 0 0 16 0V4h-5v9a3 3 0 0 1-6 0V4H4ZM4 8h5m6 0h5",
  die: "M5 3h14l2 2v14l-2 2H5l-2-2V5l2-2Zm2 4h.01M12 12h.01M17 17h.01",
  link: "m10 13 4-4m-7 6-2 2a4 4 0 0 0 6 6l4-4a4 4 0 0 0-1-6M17 9l2-2a4 4 0 0 0-6-6L9 5a4 4 0 0 0 1 6",
  tag: "M3 3h9l9 9-9 9-9-9V3Zm5 5h.01",
  map: "m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16",
  people:
    "M9 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm8 2a3 3 0 0 1 0 6M3 21v-5a6 6 0 0 1 12 0v5m3-7a4 4 0 0 1 3 4v3",
  camp: "m12 3-10 18h20L12 3Zm0 10-5 8m5-8 5 8",
  shop: "M3 10h18L19 3H5l-2 7Zm2 0v11h14V10M9 21v-7h6v7",
  question: "M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 4m0 4h.01",
  skull: "M4 10a8 8 0 1 1 16 0v4l-4 2v5H8v-5l-4-2v-4Zm4 0h1m6 0h1m-4 7v4",
  menu: "M4 6h16M4 12h16M4 18h16",
  x: "m5 5 14 14M5 19 19 5",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  sound: "m3 9 5 0 5-5v16l-5-5H3V9Zm14-2a7 7 0 0 1 0 10m3-13a11 11 0 0 1 0 16",
  mute: "m3 9 5 0 5-5v16l-5-5H3V9Zm14 0 5 6m-5 0 5-6",
  reroll: "M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5m-4 8a8 8 0 0 0 14 3l3-3m0 5v-5h-5",
  lock: "M6 10h12v11H6V10Zm2 0V6a4 4 0 0 1 8 0v4",
  check: "m4 12 5 5 11-11",
  info: "M12 11v6m0-10h.01M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0Z",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 6l3-3 3 2h4l3-2 3 3-2 3v6l2 3-3 3-3-2h-4l-3 2-3-3 2-3V9L4 6Z",
  book: "M3 3h7l2 2 2-2h7v17h-7l-2 2-2-2H3V3Zm9 2v17",
  volume: "M3 16v4h3v-4H3Zm7-6v10h3V10h-3Zm7-6v16h3V4h-3",
};
export function icon(name: string, cls = "") {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] ?? paths.diamond}"/></svg>`;
}
export function dicePips(value: number) {
  const patterns: Record<number, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  };
  return `<span class="pips" aria-hidden="true">${Array.from({ length: 9 }, (_, i) => `<i class="${patterns[value]?.includes(i) ? "on" : ""}"></i>`).join("")}</span>`;
}
