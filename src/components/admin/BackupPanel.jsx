import { useState } from "react";
import { requestLatestBackupDownload } from "../../services/adminBackupDownloadService";
import { styles } from "./adminStyles";

export default function BackupPanel() {
  const [backupDownloadLoading, setBackupDownloadLoading] = useState(false);
  const [error, setError] = useState("");

  async function downloadLatestBackup() {
    if (backupDownloadLoading) return;
    setBackupDownloadLoading(true);
    setError("");
    try {
      const { downloadUrl, filename } = await requestLatestBackupDownload();
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (reason) {
      setError(reason?.message || "Impossible de télécharger la dernière sauvegarde.");
    } finally {
      setBackupDownloadLoading(false);
    }
  }

  return (
    <section style={styles.panel}>
      <div style={styles.panelHeader}>
        <h2 style={styles.panelTitle}>Sauvegardes et restauration</h2>
        <button type="button" style={styles.addButton} onClick={downloadLatestBackup} disabled={backupDownloadLoading}>
          {backupDownloadLoading ? "Préparation du téléchargement…" : "Télécharger la dernière sauvegarde pCloud"}
        </button>
      </div>
      {error && <p role="alert" style={styles.error}>{error} Vérifier la configuration pCloud sur Netlify.</p>}
      <p style={styles.muted}>Téléchargement pCloud existant : aucune nouvelle sauvegarde n'est créée. Le lien dépend de la configuration Netlify et de l'archive présente sur pCloud.</p>
      {[
        ["GitHub — code source", "Conserver une version identifiée du code et des migrations SQL. Restauration : revenir au commit de référence, reconstruire puis redéployer sur Netlify."],
        ["Supabase — base de données", "Sauvegarder la structure, les données et les règles RLS suivant les fonctions disponibles dans votre abonnement Supabase. Tester la restauration sur une base isolée ; ne jamais écraser la production depuis cet écran."],
        ["Stripe — paiements", "Exporter et archiver les transactions pour les rapprochements. Les paiements ne se restaurent pas comme une base : ne jamais rejouer une transaction ou un webhook pour reconstruire l'historique."],
        ["pCloud — conservation", "Vérifier la date, la taille et l'intégrité des archives. Restaurer sur copie de test avant toute intervention sur l'environnement actif."],
      ].map(([title, description]) => (
        <details key={title} style={{ marginTop: 6, borderBottom: "1px solid #e5e7eb", padding: "5px 0" }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>{title}</summary>
          <p style={styles.muted}>{description}</p>
        </details>
      ))}
    </section>
  );
}
