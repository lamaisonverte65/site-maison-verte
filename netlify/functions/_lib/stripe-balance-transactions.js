export async function listAllBalanceTransactions(stripe, parameters = {}) {
  const rows = [];
  let startingAfter;

  do {
    const page = await stripe.balanceTransactions.list({
      ...parameters,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    const data = page?.data || [];
    rows.push(...data);

    if (!page?.has_more) break;
    if (!data.length || !data[data.length - 1]?.id) {
      throw new Error("Stripe balance transaction pagination returned no cursor");
    }
    const nextCursor = data[data.length - 1].id;
    if (nextCursor === startingAfter) {
      throw new Error("Stripe balance transaction pagination returned a repeated cursor");
    }
    startingAfter = nextCursor;
  } while (true);

  return rows;
}
