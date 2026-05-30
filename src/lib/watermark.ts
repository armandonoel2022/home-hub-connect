// Aplica una marca de agua diagonal repetida sobre una imagen.
// Se usa para documentos sensibles como la licencia del arma, dejando
// claro que la copia digital es "SOLO PARA CONSULTA".

export interface WatermarkOptions {
  text?: string;
  subText?: string;
  maxWidth?: number; // redimensiona si la imagen es muy grande (px)
}

export function applyWatermark(
  file: File,
  options: WatermarkOptions = {}
): Promise<string> {
  const {
    text = "SOLO PARA CONSULTA",
    subText = "",
    maxWidth = 1400,
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = reject;
      img.onload = () => {
        try {
          let { width, height } = img;
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

          // Marca de agua diagonal repetida
          const fontSize = Math.max(18, Math.round(width / 22));
          ctx.font = `bold ${fontSize}px Arial, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          ctx.save();
          ctx.translate(width / 2, height / 2);
          ctx.rotate(-Math.PI / 6);
          const step = fontSize * 4;
          const diag = Math.sqrt(width * width + height * height);
          for (let y = -diag; y < diag; y += step) {
            for (let x = -diag; x < diag; x += ctx.measureText(text).width + fontSize * 4) {
              ctx.fillStyle = "rgba(220, 38, 38, 0.22)";
              ctx.fillText(text, x, y);
            }
          }
          ctx.restore();

          // Banda inferior con texto legible
          const bandH = Math.max(28, Math.round(fontSize * 1.4));
          ctx.fillStyle = "rgba(15, 23, 42, 0.78)";
          ctx.fillRect(0, height - bandH, width, bandH);
          ctx.fillStyle = "#ffffff";
          ctx.font = `bold ${Math.round(bandH * 0.5)}px Arial, sans-serif`;
          ctx.textAlign = "left";
          ctx.fillText(`${text}${subText ? "  ·  " + subText : ""}`, 12, height - bandH / 2);

          resolve(canvas.toDataURL("image/jpeg", 0.9));
        } catch (e) {
          reject(e);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
