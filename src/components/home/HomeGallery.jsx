import { languageForPublicPage } from "../../../shared/publicSiteLocale.js";
import { getHomeCopy } from "./homeTranslations.js";
export function HomeGallery({ galleryPhotos, setCurrentImageIndex, setLightboxOpen }) {
  const language = typeof window === "undefined" ? "fr" : languageForPublicPage(window.location.href);
  const copy = getHomeCopy(language);
  return (
<section id="galerie" className="section">
        <h2>{copy.galleryTitle}</h2>

        <div className="home-gallery-grid">
          {galleryPhotos.map((photo, index) => (
            <button
              key={photo.src}
              type="button"
              className="gallery-item home-gallery-thumb"
              aria-label={copy.galleryCaptions[index] || photo.caption}
              onClick={() => {
                setCurrentImageIndex(index);
                setLightboxOpen(true);
              }}
              style={{
                position: "relative",
                overflow: "hidden",
                borderRadius: "22px",
                cursor: "pointer",
                padding: 0,
                border: 0,
                background: "transparent",
                textAlign: "left",
                boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
              }}
            >
              <img
                src={photo.src}
                alt={copy.galleryCaptions[index] || photo.caption}
                loading="lazy"
                decoding="async"
                style={{
                  width: "100%",
                  height: "210px",
                  objectFit: "cover",
                  display: "block",
                  transition: "0.35s",
                }}
              />

              <div
                className="gallery-caption"
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  width: "100%",
                  padding: "35px 16px 14px",
                  background:
                    "linear-gradient(to top, rgba(0,0,0,0.75), transparent)",
                  color: "white",
                  fontSize: "0.95rem",
                  fontWeight: "500",
                  opacity: 0,
                  transition: "0.35s",
                  pointerEvents: "none",
                }}
              >
                {copy.galleryCaptions[index] || photo.caption}
              </div>
            </button>
          ))}
        </div>
      </section>
  );
}
