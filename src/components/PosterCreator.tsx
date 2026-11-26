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

export default function PosterCreator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [templateImg, setTemplateImg] = useState<HTMLImageElement | null>(null);
  const [templateError, setTemplateError] = useState(false);
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

  // Load the template artwork once.
  useEffect(() => {
    loadImage(POSTER_TEMPLATE.src)
      .then(setTemplateImg)
      .catch(() => setTemplateError(true));
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

  const coverScale = useCallback(
    (img: HTMLImageElement) => {
      const { radius } = POSTER_TEMPLATE.photoSlot;
      return (radius * 2) / Math.min(img.width, img.height);
    },
    []
  );

  const clampPan = useCallback(
    (img: HTMLImageElement, nextZoom: number, nextPan: { x: number; y: number }) => {
      const { radius } = POSTER_TEMPLATE.photoSlot;
      const scale = coverScale(img) * nextZoom;
      const halfW = (img.width * scale) / 2;
      const halfH = (img.height * scale) / 2;
      const maxX = Math.max(0, halfW - radius);
      const maxY = Math.max(0, halfH - radius);
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

    const { cx, cy, radius } = POSTER_TEMPLATE.photoSlot;

    if (photoImg) {
      const scale = coverScale(photoImg) * zoom;
      const drawW = photoImg.width * scale;
      const drawH = photoImg.height * scale;

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(
        photoImg,
        cx + pan.x - drawW / 2,
        cy + pan.y - drawH / 2,
        drawW,
        drawH
      );
      ctx.restore();
    } else {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = "#eef1f4";
      ctx.fill();
      ctx.restore();
    }

    if (templateImg) {
      ctx.drawImage(templateImg, 0, 0, canvas.width, canvas.height);
    }
  }, [templateImg, photoImg, zoom, pan, coverScale]);

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
          <div className="poster-canvas-hint">Upload a photo to get started</div>
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
        <button
          type="button"
          className="poster-btn poster-btn-primary"
          onClick={() => fileInputRef.current?.click()}
        >
          {photoImg ? "Change Photo" : "Upload Photo"}
        </button>

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
            Share
          </button>
        </div>

        {photoImg && <p className="poster-hint-text">Drag your photo to reposition it.</p>}
        {status && <p className="poster-status">{status}</p>}
      </div>
    </div>
  );
}
