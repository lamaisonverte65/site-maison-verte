import { useEffect } from "react";

export default function ContactRedirect() {
  useEffect(() => {
    window.location.href = "mailto:contact@lamaisonverte65.fr";
  }, []);

  return <p>Ouverture de votre messagerie...</p>;
}