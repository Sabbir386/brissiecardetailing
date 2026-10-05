const fs = require("fs");
const path = require("path");
const dir = path.join("apps", "web", "public", "photos");
fs.mkdirSync(dir, { recursive: true });
const files = {
  "standard-exterior-detail.svg": "#243044",
  "standard-detail.svg": "#1d3a4a",
  "full-detail.svg": "#3a2a14",
  "clay-and-seal.svg": "#16324a",
  "wheels-off-caliper-ceramic.svg": "#2a2a2a",
  "stage-1-ceramic-coating.svg": "#1a3048",
  "off-road-reset-detail.svg": "#2c2416",
  "engine-bay-deep-clean.svg": "#243028",
  "premium-headlight-restoration.svg": "#2a2418",
  "heavy-pet-hair-sand-extraction.svg": "#322418",
};
for (const [name, color] of Object.entries(files)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#c4a574"/></linearGradient></defs><rect width="800" height="520" fill="url(#g)"/><path d="M120 330c40-70 110-120 190-130 70-8 150 10 210 55 40 30 90 40 150 36v70H150c-20 0-40-14-30-31z" fill="#f7f1e6"/><circle cx="250" cy="360" r="36" fill="#171614"/><circle cx="540" cy="360" r="36" fill="#171614"/><circle cx="250" cy="360" r="14" fill="#d7c4a3"/><circle cx="540" cy="360" r="14" fill="#d7c4a3"/></svg>`;
  fs.writeFileSync(path.join(dir, name), svg);
}
console.log("wrote", Object.keys(files).length);
