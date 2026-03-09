import type { Slide } from "@/lib/presentationData";
import logo from "@/assets/safeone-logo.png";
import building from "@/assets/safeone-building.jpeg";

export const CoverSlide = ({ slide }: { slide: Slide }) => (
  <div className="text-center py-16 relative">
    <div className="absolute inset-0 opacity-5 bg-cover bg-center rounded-3xl" style={{ backgroundImage: `url(${building})` }} />
    <div className="relative z-10">
      <img src={logo} alt="SafeOne" className="h-20 mx-auto mb-8" />
      <h1 className="font-heading font-black text-5xl md:text-6xl text-foreground mb-4 tracking-tight">
        Safe<span className="text-primary">One</span>
      </h1>
      <h2 className="font-heading text-2xl md:text-3xl text-foreground/80 mb-6">{slide.title}</h2>
      <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">{slide.subtitle}</p>
      <div className="inline-block px-6 py-2 rounded-full bg-primary/10 border border-primary/30">
        <span className="text-sm font-semibold text-primary">{slide.highlight}</span>
      </div>
    </div>
  </div>
);

export const FeatureSlide = ({ slide }: { slide: Slide }) => {
  const Icon = slide.icon!;
  return (
    <div className="py-12">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center">
          <Icon className="h-7 w-7 text-primary" />
        </div>
        <h2 className="font-heading font-bold text-3xl md:text-4xl text-foreground">{slide.title}</h2>
      </div>
      <ul className="space-y-4 ml-2">
        {slide.bullets?.map((b, i) => (
          <li key={i} className="flex items-start gap-4">
            <div className="mt-2 w-2 h-2 rounded-full bg-primary shrink-0" />
            <span className="text-lg text-foreground/85 leading-relaxed">{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const ScreenshotSlide = ({ slide }: { slide: Slide }) => {
  const Icon = slide.icon;
  return (
    <div className="py-6 flex flex-col items-center">
      <div className="flex items-center gap-3 mb-6">
        {Icon && (
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        )}
        <h2 className="font-heading font-bold text-2xl text-foreground">{slide.title}</h2>
      </div>
      <div className="w-full max-w-4xl rounded-xl overflow-hidden border-2 border-border shadow-2xl">
        <img src={slide.screenshot} alt={slide.title} className="w-full h-auto" />
      </div>
    </div>
  );
};

export const GridSlide = ({ slide }: { slide: Slide }) => (
  <div className="py-10">
    <h2 className="font-heading font-bold text-3xl md:text-4xl text-foreground text-center mb-2">{slide.title}</h2>
    {slide.subtitle && <p className="text-muted-foreground text-center mb-8">{slide.subtitle}</p>}
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {slide.gridItems?.map((item, i) => (
        <div key={i} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <item.icon className="h-5 w-5 text-primary" />
          </div>
          <span className="font-heading font-semibold text-sm text-foreground">{item.label}</span>
          <span className="text-xs text-muted-foreground text-center">{item.desc}</span>
        </div>
      ))}
    </div>
  </div>
);

export const ClosingSlide = ({ slide }: { slide: Slide }) => (
  <div className="text-center py-20 relative">
    <div className="absolute inset-0 opacity-5 bg-cover bg-center rounded-3xl" style={{ backgroundImage: `url(${building})` }} />
    <div className="relative z-10">
      <img src={logo} alt="SafeOne" className="h-16 mx-auto mb-6" />
      <h2 className="font-heading font-black text-4xl md:text-5xl text-foreground mb-4">{slide.title}</h2>
      <p className="text-xl text-muted-foreground mb-8">{slide.subtitle}</p>
      <div className="inline-block px-6 py-2 rounded-full bg-primary/10 border border-primary/30">
        <span className="text-sm font-semibold text-primary">{slide.highlight}</span>
      </div>
      <p className="mt-10 text-sm text-muted-foreground">SafeOne Security Company — RNC 101526752</p>
    </div>
  </div>
);
