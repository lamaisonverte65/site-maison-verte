export function shouldRenderAdminCalendar({ activeTab, error }) {
  return activeTab === "calendar" && !error;
}
