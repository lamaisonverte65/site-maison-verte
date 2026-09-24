import { useEffect } from "react";

export default function AppelerRedirect() {
  useEffect(() => {
    window.location.href = "tel:+33795938315";
  }, []);

  return <p>Ouverture de l'application téléphone...</p>;
}