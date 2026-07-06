import { useMemo, useState } from "react";

export function useCalendarFilters(events = []) {
  const [filters, setFilters] = useState({ showDirect: true, showExternal: true, showBlocks: true });
  const filteredEvents = useMemo(() => events.filter((event) => {
    const type = event.extendedProps?.type;
    if (type === "booking_request") return filters.showDirect;
    if (type === "external") return filters.showExternal;
    if (type === "admin_block") return filters.showBlocks;
    return true;
  }), [events, filters]);
  return { filters, setFilters, filteredEvents };
}
