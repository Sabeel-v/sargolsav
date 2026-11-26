export interface PhotoSlot {
  /** Center x/y and radius, in the same pixel space as width/height below. */
  cx: number;
  cy: number;
  radius: number;
}

export interface PosterTemplate {
  id: string;
  name: string;
  /** Path under /public pointing at the template artwork. */
  src: string;
  width: number;
  height: number;
  photoSlot: PhotoSlot;
}

// Swap `src` to "/templates/poster-template.png" once the real artwork is
// dropped into public/templates/, then update width/height/photoSlot to match
// the circular cutout in that file (open it in any image editor and read off
// the pixel coordinates of the circle's center and radius).
export const POSTER_TEMPLATE: PosterTemplate = {
  id: "mukkam-manjalam-2026",
  name: "Mukkam Manjalam Sargolsav 2026",
  src: "/templates/poster-template.svg",
  width: 1024,
  height: 1536,
  photoSlot: {
    cx: 512,
    cy: 700,
    radius: 260,
  },
};
