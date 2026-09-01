import "@/styles/auth.css";

type AuthSplitLayoutProps = {
  children: React.ReactNode;
  wideForm?: boolean;
  panelTitle: string;
  panelLead?: string;
  quote?: string;
  quoteAuthor?: string;
  quoteRole?: string;
  panelImageSrc?: string;
};

export function AuthSplitLayout({
  children,
  wideForm = false,
  panelTitle: _panelTitle,
  panelLead: _panelLead,
  quote: _quote,
  quoteAuthor: _quoteAuthor,
  quoteRole: _quoteRole,
  panelImageSrc: _panelImageSrc,
}: AuthSplitLayoutProps) {
  const panelImage = wideForm
    ? {
        src: "/ius.webp",
        srcSet: "/ius-960.webp 960w, /ius.webp 1280w",
        width: 1280,
        height: 960,
      }
    : {
        src: "/ius1.webp",
        srcSet: "/ius1-960.webp 960w, /ius1.webp 1920w",
        width: 1920,
        height: 1280,
      };
  const image = _panelImageSrc
    ? { src: _panelImageSrc, srcSet: undefined, width: panelImage.width, height: panelImage.height }
    : panelImage;

  return (
    <div className="auth-split">
      <div className="auth-split__form">
        <div className={wideForm ? "auth-split__form-inner auth-split__form-inner--wide" : "auth-split__form-inner"}>
          {children}
        </div>
      </div>

      <aside className="auth-split__panel" data-auth-variant={wideForm ? "register" : "login"} aria-label="Branding">
        <div className="auth-split__image-grid auth-split__image-grid--single" aria-hidden>
          <img
            className="auth-split__image"
            src={image.src}
            srcSet={image.srcSet}
            sizes="(max-width: 960px) 100vw, 50vw"
            width={image.width}
            height={image.height}
            alt=""
            decoding="async"
            fetchPriority="high"
          />
        </div>
      </aside>
    </div>
  );
}
