let cache = null;

const LOCATION_API = 'https://countriesnow.space/api/v0.1';

const normalize = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const getCountriesData = async () => {
  if (cache) return cache;
  const res = await fetch(`${LOCATION_API}/countries/states`);
  if (!res.ok) throw new Error('Failed to fetch countries');
  const json = await res.json();
  cache = json.data || [];
  return cache;
};

export const fetchCountries = async () => {
  const data = await getCountriesData();
  return data
    .map((c) => c.name)
    .filter(Boolean)
    .sort();
};

export const fetchStates = async (country) => {
  const data = await getCountriesData();
  const found = data.find((c) => c.name.toLowerCase() === (country || '').toLowerCase());
  return (found?.states || [])
    .map((s) => s.name)
    .filter(Boolean)
    .sort();
};

export const fetchCities = async (country, state) => {
  const res = await fetch(`${LOCATION_API}/countries/state/cities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ country, state }),
  });
  if (!res.ok) throw new Error('Failed to fetch cities');
  const json = await res.json();
  return (json.data || [])
    .map(normalize)
    .filter(Boolean)
    .sort();
};