import { useState, useEffect, useCallback, useRef } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { ChevronLeft, ChevronRight, Maximize, Minimize, Download, Loader2 } from "lucide-react";
import logo from "@/assets/safeone-logo.png";
import { slides } from "@/lib/presentationData";
import { CoverSlide, FeatureSlide, DemoSlide, GridSlide, ClosingSlide } from "@/components/presentation/SlideLayouts";

const Presentation = () => {
  const [current, setCurrent] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const slideRef = useRef<HTMLDivElement>(null);
  const total = slides.length;

  const next = useCallback(() => setCurrent((c) => Math.min(c + 1, total - 1)), [total]);
  const prev = useCallback(() => setCurrent((c) => Math.max(c - 1, 0)), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      if (e.key === "Escape" && isFullscreen) toggleFullscreen();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev, isFullscreen]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  };

  const exportToPDF = async () => {
    setExporting(true);
    const saved = current;
    const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [1280, 720] });
    for (let i = 0; i < total; i++) {
      setCurrent(i);
      await new Promise((r) => setTimeout(r, 600));
      if (slideRef.current) {
        const canvas = await html2canvas(slideRef.current, { scale: 2, backgroundColor: null, useCORS: true });
        const imgData = canvas.toDataURL("image/png");
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, 0, 1280, 720);
      }
    }
    pdf.save("SafeOne_Intranet_Presentacion.pdf");
    setCurrent(saved);
    setExporting(false);
  };

  const slide = slides[current];

  return (
    <div className={`min-h-screen flex flex-col ${isFullscreen ? "bg-[hsl(220,20%,8%)]" : "bg-background"}`}>
      {!isFullscreen && (
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <img src={logo} alt="SafeOne" className="h-8" />
            <span className="font-heading font-bold text-sm text-foreground">Presentación del Proyecto</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{current + 1} / {total}</span>
            <button onClick={exportToPDF} disabled={exporting} className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-foreground text-sm disabled:opacity-50">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {exporting ? "Exportando…" : "PDF"}
            </button>
            <button onClick={toggleFullscreen} className="p-2 rounded-lg hover:bg-muted transition-colors text-foreground">
              <Maximize className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div ref={slideRef} className="flex-1 flex items-center justify-center relative overflow-hidden select-none bg-background">
        <button onClick={prev} className="absolute left-0 top-0 bottom-0 w-20 z-10 flex items-center justify-start pl-4 opacity-0 hover:opacity-100 transition-opacity" aria-label="Previous">
          <ChevronLeft className="h-8 w-8 text-muted-foreground" />
        </button>
        <button onClick={next} className="absolute right-0 top-0 bottom-0 w-20 z-10 flex items-center justify-end pr-4 opacity-0 hover:opacity-100 transition-opacity" aria-label="Next">
          <ChevronRight className="h-8 w-8 text-muted-foreground" />
        </button>

        <div className="w-full max-w-5xl mx-auto px-8">
          {slide.layout === "cover" && <CoverSlide slide={slide} />}
          {slide.layout === "feature" && <FeatureSlide slide={slide} />}
          {slide.layout === "demo" && <DemoSlide slide={slide} />}
          {slide.layout === "grid" && <GridSlide slide={slide} />}
          {slide.layout === "closing" && <ClosingSlide slide={slide} />}
        </div>

        {isFullscreen && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-[hsl(220,15%,15%)] rounded-full px-6 py-2 opacity-0 hover:opacity-100 transition-opacity">
            <button onClick={prev} className="text-[hsl(0,0%,70%)] hover:text-[hsl(0,0%,100%)] transition-colors"><ChevronLeft className="h-5 w-5" /></button>
            <span className="text-sm text-[hsl(0,0%,70%)]">{current + 1} / {total}</span>
            <button onClick={next} className="text-[hsl(0,0%,70%)] hover:text-[hsl(0,0%,100%)] transition-colors"><ChevronRight className="h-5 w-5" /></button>
            <button onClick={toggleFullscreen} className="text-[hsl(0,0%,70%)] hover:text-[hsl(0,0%,100%)] transition-colors ml-2"><Minimize className="h-4 w-4" /></button>
          </div>
        )}
      </div>

      {!isFullscreen && (
        <div className="border-t border-border bg-card px-4 py-3 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {slides.map((s, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`shrink-0 w-24 h-14 rounded-md border-2 transition-all flex items-center justify-center text-[8px] font-medium px-1 text-center leading-tight ${
                  i === current
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50"
                }`}
              >
                {s.layout === "demo" ? "🖥️ " : ""}{s.title.length > 20 ? s.title.slice(0, 20) + "…" : s.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Presentation;
