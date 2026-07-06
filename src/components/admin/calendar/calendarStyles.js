export const calendarCss = `
        .calendar-admin-calendar .fc {
          font-size: 1.05rem;
          --fc-border-color: #dbe3ea;
          --fc-page-bg-color: #ffffff;
          --fc-neutral-bg-color: #f8fafc;
          --fc-today-bg-color: #ecfdf5;
        }

        .calendar-admin-calendar .fc-toolbar {
          gap: 14px;
          margin-bottom: 22px;
          flex-wrap: wrap;
        }

        .calendar-admin-calendar .fc-toolbar-title {
          color: #1f6f3d;
          font-size: clamp(1.55rem, 2.5vw, 2.15rem);
          font-weight: 800;
          text-transform: capitalize;
        }

        .calendar-admin-calendar .fc-button {
          background: #2f4f35 !important;
          border: none !important;
          border-radius: 999px !important;
          padding: 10px 16px !important;
          font-weight: 800 !important;
          box-shadow: 0 8px 18px rgba(47,79,53,0.18);
        }

        .calendar-admin-calendar .fc-button:hover {
          filter: brightness(1.08);
        }

        .calendar-admin-calendar .fc-col-header-cell {
          background: #eef7f0;
          padding: 12px 6px;
          color: #1f6f3d;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          font-size: 0.9rem;
        }

        .calendar-admin-calendar .fc-daygrid-day {
          background: #ffffff;
          transition: background 0.2s ease, transform 0.2s ease;
        }

        .calendar-admin-calendar .fc-daygrid-day:hover {
          background: #f8fafc;
        }

        .calendar-admin-calendar .fc-daygrid-day-frame {
          min-height: 168px;
          padding: 6px;
        }

        .calendar-admin-calendar .fc-daygrid-day-top {
          justify-content: center;
        }

        .calendar-admin-calendar .fc-event {
          border: none !important;
          border-radius: 10px !important;
          padding: 3px 6px !important;
          font-size: 0.78rem !important;
          font-weight: 800 !important;
          box-shadow: 0 4px 10px rgba(15,23,42,0.14);
        }


        .calendar-admin-calendar .fc-daygrid-event {
          margin-top: 2px !important;
          margin-bottom: 2px !important;
        }

        .calendar-admin-calendar .fc-reservation-half-day {
          overflow: hidden !important;
          white-space: nowrap !important;
          text-overflow: ellipsis !important;
        }

        .calendar-admin-calendar .fc-reservation-half-day.fc-event-start {
          margin-left: var(--reservation-edge) !important;
          border-top-left-radius: 999px !important;
          border-bottom-left-radius: 999px !important;
        }

        .calendar-admin-calendar .fc-reservation-half-day.fc-event-end {
          margin-right: var(--reservation-edge) !important;
          border-top-right-radius: 999px !important;
          border-bottom-right-radius: 999px !important;
        }

        .calendar-admin-calendar .fc-reservation-half-day .fc-event-main {
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }

        .calendar-admin-calendar .fc-bg-event {
          opacity: 1 !important;
          border-radius: 14px;
        }

        .calendar-admin-calendar .fc-day-today {
          box-shadow: inset 0 0 0 3px rgba(31,111,61,0.22);
        }

        @media (max-width: 900px) {
          .calendar-admin-layout {
            grid-template-columns: 1fr !important;
          }

          .calendar-admin-side-panel {
            order: 2;
            position: static !important;
            max-height: none !important;
          }

          .calendar-admin-calendar-scroll {
            order: 1;
            overflow-x: auto;
            padding-bottom: 10px;
            -webkit-overflow-scrolling: touch;
          }

          .calendar-admin-calendar {
            min-width: 760px;
          }

          .calendar-admin-calendar .fc {
            font-size: 0.92rem;
          }

          .calendar-admin-calendar .fc-daygrid-day-frame {
            min-height: 132px;
          }

          .calendar-admin-calendar .fc-bg-event {
            opacity: 1 !important;
          }
        }
      `;

export const styles = {
  calendarScroll: {
    width: "100%",
  },
  pendingStartCell: {
    background: "#fff7ed",
    border: "2px solid #f97316",
    borderRadius: "14px",
    padding: "4px",
  },
  pendingStartPill: {
    marginTop: "4px",
    display: "inline-block",
    padding: "3px 8px",
    borderRadius: "999px",
    background: "#f97316",
    color: "white",
    fontSize: "0.75rem",
    fontWeight: 800,
  },
  selectedRangeCell: {
    background: "#ffedd5",
    border: "2px solid #fb923c",
    borderRadius: "14px",
    padding: "4px",
  },
  selectedRangePill: {
    marginTop: "4px",
    display: "inline-block",
    padding: "3px 8px",
    borderRadius: "999px",
    background: "#ea580c",
    color: "white",
    fontSize: "0.75rem",
    fontWeight: 800,
  },
  selectionHint: {
    background: "#fff7ed",
    border: "1px solid #fdba74",
    color: "#9a3412",
    padding: "12px",
    borderRadius: "14px",
    lineHeight: 1.5,
    fontWeight: 700,
  },

  wrapper: { background: "white", borderRadius: "28px", padding: "28px", boxShadow: "0 18px 45px rgba(15,23,42,0.08)" },
  legend: { display: "flex", gap: "18px", marginBottom: "20px", flexWrap: "wrap" },
  legendItem: { display: "flex", alignItems: "center", gap: "8px" },
  layout: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(300px, 380px)", gap: "24px", alignItems: "start" },
  calendar: { minWidth: 0, background: "#ffffff", borderRadius: "24px", padding: "18px", border: "1px solid #e2e8f0", boxShadow: "0 14px 36px rgba(15,23,42,0.07)" },
  sidePanel: { background: "#f8fafc", borderRadius: "20px", padding: "18px", position: "sticky", top: "20px" },
  closePanelButton: { border: "none", borderRadius: "999px", padding: "8px 12px", background: "#e2e8f0", cursor: "pointer", marginBottom: "12px" },
  muted: { color: "#64748b", margin: "4px 0" },
  label: { display: "grid", gap: "8px", margin: "12px 0", fontWeight: 700 },
  formGrid: { display: "grid", gap: "10px", margin: "16px 0" },
  input: { padding: "12px 14px", borderRadius: "14px", border: "1px solid #d1d5db", fontSize: "14px", width: "100%", boxSizing: "border-box" },
  textarea: { padding: "12px 14px", borderRadius: "14px", border: "1px solid #d1d5db", fontSize: "14px", minHeight: "100px", resize: "vertical", width: "100%", boxSizing: "border-box" },
  checkboxLine: { display: "flex", alignItems: "center", gap: "8px", color: "#334155", fontWeight: 700, lineHeight: 1.4 },
  primaryButton: { border: "none", borderRadius: "999px", padding: "10px 14px", background: "#2f4f35", color: "white", cursor: "pointer", fontWeight: 700 },
  smallButton: { border: "none", borderRadius: "999px", padding: "8px 12px", background: "#e2e8f0", cursor: "pointer", fontWeight: 700 },
  deleteButton: { border: "none", borderRadius: "999px", background: "#dc2626", color: "white", padding: "10px 14px", cursor: "pointer" },
  blockList: { marginTop: "28px" },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" },
  blockItem: { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "center", border: "1px solid #e5e7eb", borderRadius: "16px", padding: "14px", marginBottom: "10px" },
  priceGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" },
  priceItem: { border: "1px solid #e5e7eb", borderRadius: "16px", padding: "14px", background: "#f8fafc" },
  actionsRow: { display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" },
  infoPanelGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "10px", margin: "14px 0" },
  infoBox: { border: "1px solid #e5e7eb", borderRadius: "14px", padding: "12px", background: "white", display: "grid", gap: "6px" },
  infoSection: { borderTop: "1px solid #e5e7eb", paddingTop: "12px", marginTop: "14px" },
  dayCellContent: { display: "grid", gap: "6px", justifyItems: "center", alignContent: "start", minHeight: "64px", fontWeight: 900, color: "#1f2937" },
  pastDayCell: { opacity: 0.45, filter: "grayscale(1)", cursor: "not-allowed" },
  dayPrice: { fontSize: "11px", color: "#0f766e", fontWeight: 800 },
  dayPricePill: {
    marginTop: "4px",
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: "999px",
    background: "#ecfdf5",
    color: "#0f766e",
    fontSize: "0.82rem",
    fontWeight: 800,
  },
  warningBox: {
    background: "#fffbeb",
    border: "1px solid #fbbf24",
    color: "#92400e",
    borderRadius: "14px",
    padding: "12px",
    margin: "12px 0",
    lineHeight: 1.5,
    fontWeight: 700,
  },
  importItem: {
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "14px",
    background: "white",
    margin: "14px 0",
  },
  formGridTwoCols: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: "10px",
    margin: "12px 0",
  },
};

