import { useCallback, useEffect, useRef, useState } from "react";
import { POSTER_TEMPLATE } from "../config/template";
import "./PosterCreator.css";

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

// Caption that WhatsApp (and other apps) pre-fill when sharing the poster.
const SHARE_TEXT = "Mukkam mandalam Sargolsav 2026";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Longest side we keep for an uploaded photo. Phone cameras produce
// 12–50 MP images; redrawing those on every drag frame lags low-end phones
// and can run them out of memory. 2000px is still sharper than the
// 482×588 frame even at the maximum 3× zoom.
const MAX_PHOTO_SIDE = 2000;

type PhotoSource = HTMLImageElement | HTMLCanvasElement;

function downscale(img: HTMLImageElement): PhotoSource {
  const longest = Math.max(img.naturalWidth, img.naturalHeight);
  if (longest <= MAX_PHOTO_SIDE) return img;
  const k = MAX_PHOTO_SIDE / longest;
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * k);
  c.height = Math.round(img.naturalHeight * k);
  const ctx = c.getContext("2d");
  if (!ctx) return img;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

// In-app browsers (Instagram, Facebook, etc.) usually block both file
// downloads and the share sheet, so we show the image for long-press save.
const IN_APP_BROWSER = /FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|musical_ly|Bytedance/i.test(
  typeof navigator !== "undefined" ? navigator.userAgent : ""
);

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawTagline(ctx: CanvasRenderingContext2D) {
  const t = POSTER_TEMPLATE.tagline;
  if (!t) return;

  ctx.save();
  ctx.font = `800 ${t.fontSize}px ${t.fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // Centre on the real ink bounds: Malayalam glyphs don't sit evenly
  // around a "middle" baseline.
  const m = ctx.measureText(t.text);
  const inkH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  const baseline = t.centerY - inkH / 2 + m.actualBoundingBoxAscent;

  // Text with a very soft shadow, just enough to lift it off the background.
  ctx.shadowColor = "rgba(10, 30, 80, 0.22)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = t.color;
  ctx.fillText(t.text, t.centerX, baseline);

  // Thin yellow accent underline that fades out at both ends.
  ctx.shadowColor = "transparent";
  const lineW = m.width * 0.42;
  const lineY = baseline + m.actualBoundingBoxDescent + t.fontSize * 0.32;
  const x0 = t.centerX - lineW / 2;
  const grad = ctx.createLinearGradient(x0, 0, x0 + lineW, 0);
  grad.addColorStop(0, "rgba(242, 183, 5, 0)");
  grad.addColorStop(0.2, t.accentColor);
  grad.addColorStop(0.8, t.accentColor);
  grad.addColorStop(1, "rgba(242, 183, 5, 0)");
  ctx.strokeStyle = grad;
  ctx.lineWidth = Math.max(3, t.fontSize * 0.08);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x0, lineY);
  ctx.lineTo(x0 + lineW, lineY);
  ctx.stroke();
  ctx.restore();
}

const { photoRect: PR, width: PW, height: PH } = POSTER_TEMPLATE;
const photoRectStyle: React.CSSProperties = {
  left: `${(PR.x / PW) * 100}%`,
  top: `${(PR.y / PH) * 100}%`,
  width: `${(PR.width / PW) * 100}%`,
  height: `${(PR.height / PH) * 100}%`,
  borderRadius: `${(PR.radius / PR.width) * 100}% / ${(PR.radius / PR.height) * 100}%`,
};

export default function PosterCreator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [templateImg, setTemplateImg] = useState<HTMLImageElement | null>(null);
  const [templateError, setTemplateError] = useState(false);
  const [overlayImgs, setOverlayImgs] = useState<HTMLImageElement[]>([]);
  const [photoImg, setPhotoImg] = useState<PhotoSource | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragState = useRef<{ dragging: boolean; lastX: number; lastY: number }>({
    dragging: false,
    lastX: 0,
    lastY: 0,
  });

  const [status, setStatus] = useState<string | null>(null);
  const [fontReady, setFontReady] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const pendingDelta = useRef({ dx: 0, dy: 0 });
  const rafId = useRef<number | null>(null);

  // Load the template artwork and any foreground overlay sprites once.
  useEffect(() => {
    const t = POSTER_TEMPLATE.tagline;
    if (t) {
      document.fonts
        .load(`800 ${t.fontSize}px ${t.fontFamily}`, t.text)
        .catch(() => undefined)
        .finally(() => setFontReady(true));
    }

    loadImage(POSTER_TEMPLATE.src)
      .then(setTemplateImg)
      .catch(() => setTemplateError(true));

    const overlays = POSTER_TEMPLATE.foregroundOverlays ?? [];
    Promise.all(overlays.map((o) => loadImage(o.src)))
      .then(setOverlayImgs)
      .catch(() => setOverlayImgs([]));
  }, []);

  // Load the user's uploaded photo whenever it changes.
  useEffect(() => {
    if (!photoUrl) {
      setPhotoImg(null);
      return;
    }
    let cancelled = false;
    loadImage(photoUrl)
      .then((img) => {
        if (cancelled) return;
        setPhotoImg(downscale(img));
        setZoom(1);
        setPan({ x: 0, y: 0 });
      })
      .catch(() => {
        if (cancelled) return;
        // Typically an iPhone HEIC photo on an Android browser.
        setStatus("Couldn't open that photo. Please choose a JPG or PNG image.");
        setPhotoUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [photoUrl]);

  const coverScale = useCallback((img: PhotoSource) => {
    const { width, height } = POSTER_TEMPLATE.photoRect;
    return Math.max(width / img.width, height / img.height);
  }, []);

  const clampPan = useCallback(
    (img: PhotoSource, nextZoom: number, nextPan: { x: number; y: number }) => {
      const { width, height } = POSTER_TEMPLATE.photoRect;
      const scale = coverScale(img) * nextZoom;
      const halfW = (img.width * scale) / 2;
      const halfH = (img.height * scale) / 2;
      const maxX = Math.max(0, halfW - width / 2);
      const maxY = Math.max(0, halfH - height / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, nextPan.x)),
        y: Math.min(maxY, Math.max(-maxY, nextPan.y)),
      };
    },
    [coverScale]
  );

  // Draw template + photo onto the canvas whenever anything relevant changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Only resize when needed: resetting the size reallocates the canvas
    // on every redraw, which mobile Safari handles poorly.
    if (canvas.width !== POSTER_TEMPLATE.width) canvas.width = POSTER_TEMPLATE.width;
    if (canvas.height !== POSTER_TEMPLATE.height) canvas.height = POSTER_TEMPLATE.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const { x, y, width, height, radius } = POSTER_TEMPLATE.photoRect;
    const cx = x + width / 2;
    const cy = y + height / 2;

    if (photoImg) {
      const scale = coverScale(photoImg) * zoom;
      const drawW = photoImg.width * scale;
      const drawH = photoImg.height * scale;

      if (templateImg) {
        ctx.drawImage(templateImg, 0, 0, canvas.width, canvas.height);
      }

      ctx.save();
      roundedRectPath(ctx, x, y, width, height, radius);
      ctx.clip();
      ctx.drawImage(
        photoImg,
        cx + pan.x - drawW / 2,
        cy + pan.y - drawH / 2,
        drawW,
        drawH
      );
      ctx.restore();

      const overlays = POSTER_TEMPLATE.foregroundOverlays ?? [];
      overlays.forEach((overlay, i) => {
        const img = overlayImgs[i];
        if (img) ctx.drawImage(img, overlay.x, overlay.y);
      });
    } else if (templateImg) {
      ctx.drawImage(templateImg, 0, 0, canvas.width, canvas.height);
    }

    if (templateImg) drawTagline(ctx);
  }, [templateImg, overlayImgs, photoImg, zoom, pan, coverScale, fontReady]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(URL.createObjectURL(file));
    setStatus(null);
  };

  const toCanvasDelta = (dxScreen: number, dyScreen: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { dx: 0, dy: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { dx: dxScreen * scaleX, dy: dyScreen * scaleY };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!photoImg) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    dragState.current = { dragging: true, lastX: e.clientX, lastY: e.clientY };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current.dragging || !photoImg) return;
    const dxScreen = e.clientX - dragState.current.lastX;
    const dyScreen = e.clientY - dragState.current.lastY;
    dragState.current.lastX = e.clientX;
    dragState.current.lastY = e.clientY;
    const { dx, dy } = toCanvasDelta(dxScreen, dyScreen);
    // Batch moves into one redraw per frame; touch screens can fire
    // 120+ events a second, which would otherwise redraw for each.
    pendingDelta.current.dx += dx;
    pendingDelta.current.dy += dy;
    if (rafId.current !== null) return;
    const img = photoImg;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      const d = pendingDelta.current;
      pendingDelta.current = { dx: 0, dy: 0 };
      setPan((prev) => clampPan(img, zoom, { x: prev.x + d.dx, y: prev.y + d.dy }));
    });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragState.current.dragging = false;
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const handleZoomChange = (value: number) => {
    setZoom(value);
    if (photoImg) setPan((prev) => clampPan(photoImg, value, prev));
  };

  const getCanvasBlob = (): Promise<Blob | null> =>
    new Promise((resolve) => {
      canvasRef.current?.toBlob((blob) => resolve(blob), "image/png");
    });

  const showPreview = (blob: Blob) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(blob));
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const handleDownload = async () => {
    const blob = await getCanvasBlob();
    if (!blob) {
      setStatus("Couldn't create the poster image. Please try again.");
      return;
    }
    if (IN_APP_BROWSER) {
      showPreview(blob);
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "poster.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoking right away cancels the download in Safari and Firefox.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  const handleShare = async () => {
    const blob = await getCanvasBlob();
    if (!blob) {
      setStatus("Couldn't create the poster image. Please try again.");
      return;
    }
    const file = new File([blob], "poster.png", { type: "image/png" });

    const nav = navigator as Navigator & {
      canShare?: (data?: { files?: File[] }) => boolean;
      share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
    };

    if (nav.canShare?.({ files: [file] }) && nav.share) {
      try {
        await nav.share({
          files: [file],
          title: SHARE_TEXT,
          text: SHARE_TEXT,
        });
      } catch {
        /* user cancelled share sheet */
      }
    } else {
      setStatus("Sharing isn't supported on this browser — downloading instead.");
      await handleDownload();
    }
  };

  return (
    <div className="poster-creator">
      <div className="poster-canvas-wrap">
        {templateError && (
          <div className="poster-template-error">
            Couldn't load the poster template. Make sure a file exists at{" "}
            <code>{POSTER_TEMPLATE.src}</code>.
          </div>
        )}
        <canvas ref={canvasRef} className="poster-canvas" />
        {photoImg && (
          // Drag surface limited to the photo frame, so swiping anywhere
          // else on the poster still scrolls the page on touch screens.
          <div
            className="poster-photo-drag"
            style={photoRectStyle}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        )}
        {!photoImg && (
          <button
            type="button"
            className="poster-upload-overlay"
            onClick={() => fileInputRef.current?.click()}
            style={photoRectStyle}
          >
            <span className="poster-upload-card">
              <svg viewBox="0 0 24 24" className="poster-upload-icon" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 3a1 1 0 0 1 1 1v9.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.42l2.3 2.3V4a1 1 0 0 1 1-1Z M5 18a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Z"
                />
              </svg>
              <span>Upload Your Photo</span>
            </span>
          </button>
        )}
      </div>

      <div className="poster-controls">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="poster-file-input"
        />
        {photoImg && (
          <button
            type="button"
            className="poster-btn poster-btn-primary"
            onClick={() => fileInputRef.current?.click()}
          >
            Change Photo
          </button>
        )}

        {photoImg && (
          <div className="poster-zoom">
            <label htmlFor="zoom">Zoom</label>
            <input
              id="zoom"
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(e) => handleZoomChange(Number(e.target.value))}
            />
          </div>
        )}

        <div className="poster-actions">
          <button
            type="button"
            className="poster-btn"
            onClick={handleDownload}
            disabled={!photoImg}
          >
            Download
          </button>
          <button
            type="button"
            className="poster-btn poster-btn-accent"
            onClick={handleShare}
            disabled={!photoImg}
          >
            <svg viewBox="0 0 32 32" className="poster-whatsapp-icon" aria-hidden="true">
              <path
                fill="#25D366"
                d="M16 3C9 3 3.3 8.6 3.3 15.5c0 2.4.7 4.7 1.9 6.7L3 29l7-2.1c1.9 1.1 4 1.6 6 1.6 7 0 12.7-5.6 12.7-12.5S23 3 16 3Z"
              />
              <path
                fill="#fff"
                d="M23 19.3c-.3.9-1.7 1.7-2.5 1.8-.6.1-1.4.2-4.3-1-3.6-1.5-5.9-5.1-6-5.4-.2-.3-1.4-1.9-1.4-3.6 0-1.7.9-2.6 1.2-2.9.3-.3.6-.4.9-.4h.6c.2 0 .5 0 .7.6.3.7.9 2.4 1 2.6.1.2.2.4 0 .6-.1.2-.2.4-.4.6l-.6.6c-.2.2-.4.4-.2.8.2.3.9 1.6 2 2.5 1.4 1.2 2.5 1.6 2.9 1.8.3.1.5.1.7-.1.2-.3.8-.9 1-1.2.2-.3.4-.2.7-.1l2.1 1c.2.1.4.2.5.3.1.2.1 1-.2 1.9Z"
              />
            </svg>
            Share
          </button>
        </div>

        {photoImg && <p className="poster-hint-text">Drag your photo to reposition it.</p>}
        {status && <p className="poster-status">{status}</p>}
      </div>

      {previewUrl && (
        <div className="poster-preview" role="dialog" aria-modal="true">
          <p className="poster-preview-text">
            Long-press the poster and choose “Save image”.
          </p>
          <img src={previewUrl} alt="Your poster" className="poster-preview-img" />
          <button type="button" className="poster-btn" onClick={closePreview}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}
