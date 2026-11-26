import { useCallback, useEffect, useRef, useState } from "react";
import { POSTER_TEMPLATE } from "../config/template";
import "./PosterCreator.css";

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

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

export default function PosterCreator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [templateImg, setTemplateImg] = useState<HTMLImageElement | null>(null);
  const [templateError, setTemplateError] = useState(false);
  const [overlayImgs, setOverlayImgs] = useState<HTMLImageElement[]>([]);
  const [photoImg, setPhotoImg] = useState<HTMLImageElement | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragState = useRef<{ dragging: boolean; lastX: number; lastY: number }>({
    dragging: false,
    lastX: 0,
    lastY: 0,
  });

  const [status, setStatus] = useState<string | null>(null);

  // Load the template artwork and any foreground overlay sprites once.
  useEffect(() => {
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
    loadImage(photoUrl).then((img) => {
      if (!cancelled) {
        setPhotoImg(img);
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [photoUrl]);

  const coverScale = useCallback((img: HTMLImageElement) => {
    const { width, height } = POSTER_TEMPLATE.photoRect;
    return Math.max(width / img.width, height / img.height);
  }, []);

  const clampPan = useCallback(
    (img: HTMLImageElement, nextZoom: number, nextPan: { x: number; y: number }) => {
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

    canvas.width = POSTER_TEMPLATE.width;
    canvas.height = POSTER_TEMPLATE.height;
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
  }, [templateImg, overlayImgs, photoImg, zoom, pan, coverScale]);

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

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!photoImg) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    dragState.current = { dragging: true, lastX: e.clientX, lastY: e.clientY };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragState.current.dragging || !photoImg) return;
    const dxScreen = e.clientX - dragState.current.lastX;
    const dyScreen = e.clientY - dragState.current.lastY;
    dragState.current.lastX = e.clientX;
    dragState.current.lastY = e.clientY;
    const { dx, dy } = toCanvasDelta(dxScreen, dyScreen);
    setPan((prev) => clampPan(photoImg, zoom, { x: prev.x + dx, y: prev.y + dy }));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
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

  const handleDownload = async () => {
    const blob = await getCanvasBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "poster.png";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    const blob = await getCanvasBlob();
    if (!blob) return;
    const file = new File([blob], "poster.png", { type: "image/png" });

    const nav = navigator as Navigator & {
      canShare?: (data?: { files?: File[] }) => boolean;
      share?: (data: { files?: File[]; title?: string }) => Promise<void>;
    };

    if (nav.canShare?.({ files: [file] }) && nav.share) {
      try {
        await nav.share({ files: [file], title: POSTER_TEMPLATE.name });
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
        <canvas
          ref={canvasRef}
          className="poster-canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
        {!photoImg && (
          <button
            type="button"
            className="poster-upload-overlay"
            onClick={() => fileInputRef.current?.click()}
            style={{
              left: `${(POSTER_TEMPLATE.photoRect.x / POSTER_TEMPLATE.width) * 100}%`,
              top: `${(POSTER_TEMPLATE.photoRect.y / POSTER_TEMPLATE.height) * 100}%`,
              width: `${(POSTER_TEMPLATE.photoRect.width / POSTER_TEMPLATE.width) * 100}%`,
              height: `${(POSTER_TEMPLATE.photoRect.height / POSTER_TEMPLATE.height) * 100}%`,
              borderRadius: `${(POSTER_TEMPLATE.photoRect.radius / POSTER_TEMPLATE.photoRect.width) * 100}% / ${(POSTER_TEMPLATE.photoRect.radius / POSTER_TEMPLATE.photoRect.height) * 100}%`,
            }}
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
    </div>
  );
}
