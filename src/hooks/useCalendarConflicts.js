import { useMemo } from "react";

export function useCalendarConflicts(events = [], selectedPeriod = null) {
  const conflicts = useMemo(() => {
    if (!selectedPeriod?.startStr || !selectedPeriod?.endStr) return [];
    return events.filter((event) => {
      const type = event.extendedProps?.type;
      if (!["booking_request", "external", "admin_block"].includes(type)) return false;
      return selectedPeriod.startStr < event.end && selectedPeriod.endStr > event.start;
    });
  }, [events, selectedPeriod]);
  return { conflicts, hasConflicts: conflicts.length > 0 };
}
