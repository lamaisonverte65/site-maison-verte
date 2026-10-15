export function HomeFaq({ faqCategories, setOpenFaqCategory, openFaqCategory, setOpenFaqIndex, openFaqIndex }) {
  return (
<section id="faq" className="section">
        <h2>Questions fréquentes</h2>

        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          {faqCategories.map((category, categoryIndex) => (
            <div
              key={category.title}
              style={{
                background: "white",
                borderRadius: "22px",
                marginBottom: "18px",
                boxShadow: "0 8px 25px rgba(0,0,0,0.06)",
                overflow: "hidden",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setOpenFaqCategory(
                    openFaqCategory === categoryIndex ? null : categoryIndex,
                  )
                }
                style={{
                  width: "100%",
                  border: "none",
                  background: "white",
                  padding: "24px",
                  textAlign: "left",
                  fontSize: "1.15rem",
                  fontWeight: "700",
                  color: "#2f4f35",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>{category.title}</span>
                <span>{openFaqCategory === categoryIndex ? "−" : "+"}</span>
              </button>

              {openFaqCategory === categoryIndex && (
                <div
                  style={{
                    padding: "0 18px 18px",
                  }}
                >
                  {category.items.map((item, index) => {
                    const itemKey = `${categoryIndex}-${index}`;

                    return (
                      <div
                        key={item.question}
                        style={{
                          background: "#f8f8f8",
                          borderRadius: "14px",
                          marginBottom: "10px",
                          overflow: "hidden",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setOpenFaqIndex(
                              openFaqIndex === itemKey ? null : itemKey,
                            )
                          }
                          style={{
                            width: "100%",
                            border: "none",
                            background: "#f8f8f8",
                            padding: "18px",
                            textAlign: "left",
                            fontWeight: "600",
                            cursor: "pointer",
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <span>{item.question}</span>

                          <span>{openFaqIndex === itemKey ? "−" : "+"}</span>
                        </button>

                        {openFaqIndex === itemKey && (
                          <div
                            style={{
                              padding: "0 18px 18px",
                              color: "#555",
                              lineHeight: "1.8",
                            }}
                          >
                            {item.answer}
                            {item.linkUrl && (
                              <div style={{ marginTop: "12px" }}>
                                <a
                                  href={item.linkUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    color: "#1f6f3d",
                                    fontWeight: "700",
                                    textDecoration: "none",
                                  }}
                                >
                                  {item.linkLabel || "Voir le document →"}
                                </a>
                              </div>
                            )}
                            {item.planUrl && (
                              <div style={{ marginTop: "12px" }}>
                                <a
                                  href={item.planUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    color: "#1f6f3d",
                                    fontWeight: "700",
                                    textDecoration: "none",
                                  }}
                                >
                                  Voir le plan d’accès et de stationnement →
                                </a>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
  );
}
