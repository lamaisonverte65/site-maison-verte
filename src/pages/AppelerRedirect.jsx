import { useEffect } from "react";

export default function AppelerRedirect() {
  useEffect(() => {
    window.location.href = "tel:+33663076314";
  }, []);

  return <p>Ouverture de l'application téléphone...</p>;
}