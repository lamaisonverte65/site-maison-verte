import { useMemo } from "react";

function byNewest(a, b) {
  return new Date(b.date || 0) - new Date(a.date || 0);
}

export function useCommunicationTimeline(items = []) {
  const timeline = useMemo(() => (items || []).slice().sort(byNewest), [items]);

  const emailItems = useMemo(
    () => timeline.filter((item) => item.type === "email"),
    [timeline]
  );

  const eventItems = useMemo(
    () => timeline.filter((item) => item.type === "event"),
    [timeline]
  );

  const messageItems = useMemo(
    () => timeline.filter((item) => item.type === "message"),
    [timeline]
  );

  const statistics = useMemo(() => {
    const emailStatusCounts = emailItems.reduce((acc, item) => {
      const status = item.raw?.status || "unknown";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const lastItem = timeline[0] || null;

    return {
      total: timeline.length,
      emails: emailItems.length,
      events: eventItems.length,
      messages: messageItems.length,
      emailStatusCounts,
      lastItem,
    };
  }, [timeline, emailItems, eventItems, messageItems]);

  return {
    timeline,
    emailItems,
    eventItems,
    messageItems,
    statistics,
  };
}
