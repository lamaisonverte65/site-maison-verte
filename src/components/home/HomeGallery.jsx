export function HomeGallery({ galleryPhotos, setCurrentImageIndex, setLightboxOpen }) {
  return (
<section id="galerie" className="section">
        <h2>Galerie immersive</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "16px",
          }}
        >
          {galleryPhotos.map((photo, index) => (
            <div
              key={photo.src}
              className="gallery-item"
              onClick={() => {
                setCurrentImageIndex(index);
                setLightboxOpen(true);
              }}
              style={{
                position: "relative",
                overflow: "hidden",
                borderRadius: "22px",
                cursor: "pointer",
                boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
              }}
            >
              <img
                src={photo.src}
                alt={photo.caption}
                loading={index === 0 ? "eager" : "lazy"}
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
                {photo.caption}
              </div>
            </div>
          ))}
        </div>
      </section>
  );
}
