export interface PhotoRect {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Corner radius used to clip the uploaded photo to match the frame. */
  radius: number;
}

export interface ForegroundOverlay {
  /** Path under /public for a small transparent-background sprite. */
  src: string;
  x: number;
  y: number;
}

export interface Tagline {
  text: string;
  /** Centre of the badge in poster pixels. */
  centerX: number;
  centerY: number;
  fontSize: number;
  fontFamily: string;
  /** Text colour. */
  color: string;
  /** Colour of the thin underline accent. */
  accentColor: string;
}

export interface PosterTemplate {
  id: string;
  name: string;
  /** Path under /public pointing at the template artwork. */
  src: string;
  width: number;
  height: number;
  photoRect: PhotoRect;
  /**
   * Decorative elements that overlap photoRect in the source artwork (e.g. a
   * graduation cap dipping into the frame) get covered by the uploaded
   * photo. List any such fragments here, pre-extracted as small
   * transparent-background sprites, and they'll be redrawn on top after the
   * photo so they're never lost.
   */
  foregroundOverlays?: ForegroundOverlay[];
  /** Tagline text drawn on top of everything (e.g. "I'm participating"). */
  tagline?: Tagline;
}

// The template is drawn as the full poster background (including its own
// sample photo); the uploaded photo is then composited on top, clipped to
// photoRect, which covers the sample photo exactly. No transparency/alpha
// cutout is required in the template PNG.
export const POSTER_TEMPLATE: PosterTemplate = {
  id: "mukkam-manjalam-sargolsav-2026",
  name: "Mukkam Manjalam Sargolsav 2026",
  src: "/templates/poster.png",
  width: 1024,
  height: 1535,
  photoRect: {
    x: 272,
    y: 458,
    width: 482,
    height: 588,
    radius: 46,
  },
  foregroundOverlays: [
    // The graduation cap's bottom tip dips into the top-right corner of the
    // photo frame; this sprite is that fragment, cut from the original
    // poster.png, so it survives being drawn over by the uploaded photo.
    { src: "/templates/cap-overlay.png", x: 655, y: 445 },
  ],
  // Sits in the open space between the photo frame and the date pills,
  // clear of the books (left) and the music staff (right).
  tagline: {
    text: "ഞാനും പങ്കെടുക്കുന്നു",
    centerX: 512,
    centerY: 1140,
    fontSize: 50,
    fontFamily: '"Baloo Chettan 2", "Noto Sans Malayalam", "Nirmala UI", sans-serif',
    color: "#1a3a8f",
    accentColor: "#f2b705",
  },
};
