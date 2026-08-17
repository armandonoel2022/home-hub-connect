// Aplica una marca de agua diagonal repetida sobre una imagen.
// Se usa para documentos sensibles como la licencia del arma o la cédula,
// dejando claro que la copia digital es "CONFIDENCIAL · SOLO PARA MOSTRAR".

export interface WatermarkOptions {
  text?: string;
  subText?: string;
  maxWidth?: number; // redimensiona si la imagen es muy grande (px)
}

export const WATERMARK_TEXT = "CONFIDENCIAL · SOLO PARA MOSTRAR";

/** Dibuja la marca de agua sobre un canvas ya pintado con la imagen. */
export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  text = WATERMARK_TEXT,
  subText = "",
) {
  const fontSize = Math.max(16, Math.round(width / 26));
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  const textW = ctx.measureText(text).width;
  const stepX = textW + fontSize * 2.5;
  const stepY = fontSize * 3;
  const diag = Math.sqrt(width * width + height * height);

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-Math.PI / 6);
  for (let y = -diag; y < diag; y += stepY) {
    // desplazamiento alterno para un patrón tipo "ladrillo"
    const offset = (Math.round((y + diag) / stepY) % 2) * (stepX / 2);
    for (let x = -diag + offset; x < diag; x += stepX) {
      ctx.fillStyle = "rgba(220, 38, 38, 0.34)";
      ctx.fillText(text, x, y);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.30)";
      ctx.lineWidth = Math.max(1, fontSize / 18);
      ctx.strokeText(text, x, y);
    }
  }
  ctx.restore();

  // Banda inferior con texto legible
  const bandH = Math.max(26, Math.round(fontSize * 1.5));
  ctx.fillStyle = "rgba(15, 23, 42, 0.80)";
  ctx.fillRect(0, height - bandH, width, bandH);
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.round(bandH * 0.48)}px Arial, sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText(`${text}${subText ? "  ·  " + subText : ""}`, 12, height - bandH / 2);
}

function watermarkFromDataUrl(
  src: string,
  { text = WATERMARK_TEXT, subText = "", maxWidth = 1400 }: WatermarkOptions,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onerror = reject;
    img.onload = () => {
      try {
        let { width, height } = img;
        if (!width || !height) return reject(new Error("Imagen inválida"));
        if (width > maxWidth) {
          height = Math.round((maxWidth / width) * height);
          width = maxWidth;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("No se pudo crear el contexto de dibujo"));

        ctx.drawImage(img, 0, 0, width, height);
        drawWatermark(ctx, width, height, text, subText);

        resolve(canvas.toDataURL("image/jpeg", 0.9));
      } catch (e) {
        reject(e);
      }
    };
    img.src = src;
  });
}

export function applyWatermark(
  file: File,
  options: WatermarkOptions = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      watermarkFromDataUrl(reader.result as string, options).then(resolve, reject);
    };
    reader.readAsDataURL(file);
  });
}

/** Marca de agua CSS repetida, para imágenes que ya están almacenadas sin ella. */
export function watermarkOverlayStyle(text = WATERMARK_TEXT): React.CSSProperties {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="150">
    <text x="0" y="90" transform="rotate(-30 0 90)" font-family="Arial, sans-serif" font-size="22"
      font-weight="bold" fill="rgba(220,38,38,0.35)" stroke="rgba(255,255,255,0.28)" stroke-width="0.8">${text}</text>
  </svg>`;
  return {
    backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`,
    backgroundRepeat: "repeat",
    pointerEvents: "none",
  };
}
