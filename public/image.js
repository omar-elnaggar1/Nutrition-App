// Shrinks a photo on the phone before upload, so scans are fast and cheap.
// Phone photos are often 3–12 MB; this turns them into a ~200–500 KB JPEG
// that's still sharp enough for Claude to read small label text.

const MAX_SIDE = 1568; // Claude downsizes anything larger anyway, so bigger only costs more
const JPEG_QUALITY = 0.85;

/** Returns { base64, mediaType, previewUrl } for a photo File. Throws if the file can't be opened. */
export async function shrinkPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode(); // browsers apply the phone's rotation (EXIF) automatically

    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // transparent PNGs would otherwise turn black as JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    return { base64: dataUrl.split(',')[1], mediaType: 'image/jpeg', previewUrl: dataUrl };
  } finally {
    URL.revokeObjectURL(url);
  }
}
