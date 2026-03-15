export type Area = { width: number; height: number; x: number; y: number };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.crossOrigin = "anonymous";
    img.src = src;
  });
}

export async function cropImageToDataUrl(
  imageSrc: string,
  crop: Area,
  opts?: { maxSize?: number; mimeType?: string; quality?: number }
): Promise<string> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const maxSize = opts?.maxSize ?? 512;
  const mimeType = opts?.mimeType ?? "image/jpeg";
  const quality = opts?.quality ?? 0.9;

  const scale = Math.min(maxSize / crop.width, maxSize / crop.height, 1);
  canvas.width = Math.round(crop.width * scale);
  canvas.height = Math.round(crop.height * scale);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return canvas.toDataURL(mimeType, quality);
}

