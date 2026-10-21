/**
 * Client-side image utilities: resize/compress and apply a "Déclic Studio"
 * watermark overlay before uploading previews to Supabase Storage.
 */

const WATERMARK_TEXT = 'Déclic Studio';
const MAX_PREVIEW_WIDTH = 2048;
const PREVIEW_QUALITY = 0.82;

export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load image: ${file.name}`));
    };
    img.src = url;
  });
}

function drawWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const baseSize = Math.min(width, height);
  const fontSize = Math.max(18, baseSize * 0.045);
  ctx.save();
  ctx.font = `500 ${fontSize}px "Cormorant Garamond", serif`;
  ctx.fillStyle = 'rgba(245, 245, 245, 0.35)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Center watermark
  ctx.fillText(WATERMARK_TEXT, width / 2, height / 2);

  // Bottom-right small tag
  const smallSize = Math.max(12, baseSize * 0.022);
  ctx.font = `400 ${smallSize}px "Inter", sans-serif`;
  ctx.fillStyle = 'rgba(245, 245, 245, 0.5)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(WATERMARK_TEXT, width - 24, height - 24);
  ctx.restore();
}

export async function compressAndWatermark(file: File): Promise<ProcessedImage> {
  const img = await loadImageFromFile(file);
  const scale = Math.min(1, MAX_PREVIEW_WIDTH / img.naturalWidth);
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(img, 0, 0, width, height);
  drawWatermark(ctx, width, height);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
      'image/jpeg',
      PREVIEW_QUALITY,
    );
  });

  return { blob, width, height };
}

/** Generate a quick thumbnail data URL for upload progress UI. */
export async function makeThumbnail(file: File, size = 120): Promise<string> {
  const img = await loadImageFromFile(file);
  const scale = Math.min(1, size / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.6);
}
