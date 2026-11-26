# Sargolsav 2026 Poster Creator

A single-page React app that lets a visitor upload their photo and instantly
generate a personalized poster, entirely in the browser (no backend, no
upload to any server). They can then download the result or share it
directly via the Web Share API.

## Run locally

```bash
npm install
npm run dev
```

## How it works

- `src/config/template.ts` describes the poster artwork: its pixel
  dimensions and `photoRect` — the rounded-rectangle region (`x`, `y`,
  `width`, `height`, `radius`) where the uploaded photo gets composited.
- `src/components/PosterCreator.tsx` draws the template PNG as the full
  poster background (including its own sample photo), then draws the
  user's uploaded photo on top, clipped to `photoRect` — which exactly
  covers the sample photo. **No transparency/alpha cutout is needed** in
  the template file; a plain flattened PNG/JPG export works.
- Users can drag to reposition the photo and use the zoom slider to crop
  it, then "Download" (saves a PNG) or "Share" (opens the native share
  sheet with the image file on supported mobile browsers, falling back to
  download).

The current template is `public/templates/poster.png` (1024×1535), with
`photoRect` set to `{ x: 272, y: 458, width: 482, height: 588, radius: 46 }`
— measured directly from that file's photo frame.

The graduation cap graphic dips slightly into the top-right corner of the
photo frame in the source art, so it would normally get covered by the
uploaded photo there. `foregroundOverlays` in the config fixes this: it's
a small transparent-background sprite (`public/templates/cap-overlay.png`,
pre-extracted from that corner of the original artwork) that gets redrawn
on top after the photo, at a fixed position, so the cap always stays
intact regardless of what photo is behind it.

## Swapping in a different poster design

1. Save the new PNG to `public/templates/poster.png` (or update `src` in
   the config below to point at a new filename).
2. Open it in any image editor (Photopea, Figma, Photoshop, etc.) and read
   off, in pixels: the full image width/height, and the photo frame's
   top-left corner (x, y), width, height, and corner radius.
3. If any decoration overlaps the photo frame in the new design, crop that
   fragment out as its own small PNG with a transparent background (erase
   everything except the decoration) and add it to `foregroundOverlays`
   with its (x, y) position. Otherwise omit `foregroundOverlays` entirely.
4. Update `src/config/template.ts`:

```ts
export const POSTER_TEMPLATE: PosterTemplate = {
  id: "mukkam-manjalam-sargolsav-2026",
  name: "Mukkam Manjalam Sargolsav 2026",
  src: "/templates/poster.png",
  width: 1024,   // real PNG width
  height: 1535,  // real PNG height
  photoRect: { x: 272, y: 458, width: 482, height: 588, radius: 46 },
};
```

That's it — no other code changes needed.

## Deploy to Vercel

This is a standard Vite app, so Vercel auto-detects the framework.

**Option A — via Git (recommended):** push this repo to GitHub, then in
Vercel click "New Project" → import the repo. Vercel will use
`npm run build` and serve the `dist/` output automatically.

**Option B — via CLI:**

```bash
npm install -g vercel
vercel        # first deploy, follow prompts
vercel --prod # subsequent production deploys
```

No environment variables or server-side config are required — everything
runs client-side.
