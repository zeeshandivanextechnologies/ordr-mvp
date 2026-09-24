const CURRENCY_API =
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies.json';

export const fetchCurrencies = async () => {
  const res = await fetch(CURRENCY_API);
  if (!res.ok) throw new Error('Failed to fetch currencies');
  const json = await res.json();
  return Object.keys(json)
    .map((code) => code.toUpperCase())
    .sort();
};