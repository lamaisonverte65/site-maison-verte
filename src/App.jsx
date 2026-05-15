import MaisonVerte from "./components/MaisonVerte";
import Admin from "./components/Admin";

export default function App() {
  const isAdminPage = window.location.pathname === "/admin";

  return isAdminPage ? <Admin /> : <MaisonVerte />;
}