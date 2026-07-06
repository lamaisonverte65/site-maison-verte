import { useMemo } from "react";

const SEGMENT_LABELS = {
  loyal: "Fidèles",
  high_value: "Forte valeur",
  follow_up: "À relancer",
  upcoming: "Séjour à venir",
  opt_in: "Opt-in",
  no_contact: "Contact manquant",
  dormant: "Dormants",
  first_time: "Premier séjour",
};

function uniqueById(customers = []) {
  return customers.filter((customer, index, list) => list.findIndex((item) => item.id === customer.id) === index);
}

export function useCrmSegments(data) {
  return useMemo(() => {
    const customers = data?.customers || [];
    const segments = [
      {
        key: "loyal",
        label: SEGMENT_LABELS.loyal,
        description: "Clients ayant déjà réservé plusieurs fois.",
        customers: data?.loyalCustomers || [],
      },
      {
        key: "high_value",
        label: SEGMENT_LABELS.high_value,
        description: "Clients dont le montant total dépensé dépasse 1000 €.",
        customers: data?.highValueCustomers || [],
      },
      {
        key: "follow_up",
        label: SEGMENT_LABELS.follow_up,
        description: "Clients contactables, sans séjour futur, à recontacter.",
        customers: data?.followUpCustomers || [],
      },
      {
        key: "upcoming",
        label: SEGMENT_LABELS.upcoming,
        description: "Clients avec un séjour à venir.",
        customers: data?.customersWithUpcomingStay || [],
      },
      {
        key: "opt_in",
        label: SEGMENT_LABELS.opt_in,
        description: "Clients ayant accepté les communications marketing.",
        customers: data?.marketingOptIn || [],
      },
      {
        key: "no_contact",
        label: SEGMENT_LABELS.no_contact,
        description: "Clients sans email ni téléphone exploitable.",
        customers: data?.customersWithoutContact || [],
      },
      {
        key: "dormant",
        label: SEGMENT_LABELS.dormant,
        description: "Clients anciens sans séjour récent.",
        customers: customers.filter((customer) => Number(customer.daysSinceLastStay || 0) > 900 && !customer.nextStay),
      },
      {
        key: "first_time",
        label: SEGMENT_LABELS.first_time,
        description: "Clients avec un seul séjour connu.",
        customers: customers.filter((customer) => Number(customer.bookingCount || 0) === 1),
      },
    ];

    return {
      segments: segments.map((segment) => ({ ...segment, customers: uniqueById(segment.customers) })),
      labels: SEGMENT_LABELS,
    };
  }, [data]);
}
