// Public holidays per country. To add a country, add an entry with a name and a function
// returning that year's holidays as [{ date: 'YYYY-MM-DD', name }].
const p2 = n => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${p2(m)}-${p2(d)}`;

// Gregorian Easter Sunday (anonymous algorithm), returned as a Date.
function easterSunday(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}
const offsetDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return iso(d.getFullYear(), d.getMonth() + 1, d.getDate()); };

const COUNTRIES = {
  MT: {
    name: 'Malta',
    holidays: y => [
      { date: iso(y, 1, 1),   name: "New Year's Day" },
      { date: iso(y, 2, 10),  name: "St Paul's Shipwreck" },
      { date: iso(y, 3, 19),  name: 'St Joseph' },
      { date: iso(y, 3, 31),  name: 'Freedom Day' },
      { date: offsetDays(easterSunday(y), -2), name: 'Good Friday' },
      { date: iso(y, 5, 1),   name: "Workers' Day" },
      { date: iso(y, 6, 7),   name: 'Sette Giugno' },
      { date: iso(y, 6, 29),  name: 'St Peter & St Paul' },
      { date: iso(y, 8, 15),  name: 'Assumption' },
      { date: iso(y, 9, 8),   name: 'Victory Day' },
      { date: iso(y, 9, 21),  name: 'Independence Day' },
      { date: iso(y, 12, 8),  name: 'Immaculate Conception' },
      { date: iso(y, 12, 13), name: 'Republic Day' },
      { date: iso(y, 12, 25), name: 'Christmas Day' },
    ],
  },
};

// ---------------------------------------------------------------------------------------------
// More countries come from the free Nager.Date service (https://date.nager.at). Only a country
// code and a year are ever sent. Results are cached in this browser, so after the first load a
// country works offline. Malta above is built in and never needs the network.
// ---------------------------------------------------------------------------------------------
const NAGER = 'https://date.nager.at/api/v3';
const HOL_KEY = 'vibetime.holidays', CTRY_KEY = 'vibetime.countries', HOL_TTL = 180 * 864e5;
const _store = (() => { try { return JSON.parse(localStorage.getItem(HOL_KEY)) || {}; } catch { return {}; } })();
const _inflight = {}, _failed = {}, _names = {};

const REGION_NAMES = {
  'GB-ENG': 'England', 'GB-NIR': 'Northern Ireland', 'GB-SCT': 'Scotland', 'GB-WLS': 'Wales',
  'AU-NSW': 'New South Wales', 'AU-VIC': 'Victoria', 'AU-QLD': 'Queensland', 'AU-SA': 'South Australia', 'AU-WA': 'Western Australia',
  'AU-TAS': 'Tasmania', 'AU-ACT': 'Australian Capital Territory', 'AU-NT': 'Northern Territory',
  'DE-BW': 'Baden-Württemberg', 'DE-BY': 'Bavaria', 'DE-BE': 'Berlin', 'DE-BB': 'Brandenburg', 'DE-HB': 'Bremen', 'DE-HH': 'Hamburg',
  'DE-HE': 'Hesse', 'DE-MV': 'Mecklenburg-Vorpommern', 'DE-NI': 'Lower Saxony', 'DE-NW': 'North Rhine-Westphalia', 'DE-RP': 'Rhineland-Palatinate',
  'DE-SL': 'Saarland', 'DE-SN': 'Saxony', 'DE-ST': 'Saxony-Anhalt', 'DE-SH': 'Schleswig-Holstein', 'DE-TH': 'Thuringia',
};
const regionLabel = c => REGION_NAMES[c] || c;

// Keep real public holidays; a holiday is "national" if it applies in every region the service lists for the country.
function normalizeHolidays(raw) {
  const pub = raw.filter(x => (x.types || ['Public']).includes('Public'));
  const all = new Set(pub.flatMap(x => x.counties || []));
  const national = x => x.global || !x.counties || [...all].every(c => x.counties.includes(c));
  const seen = new Set();
  return pub.map(x => ({ date: x.date, name: x.name, regions: national(x) ? null : x.counties }))
    .filter(x => { const k = x.date + x.name; if (seen.has(k)) return false; seen.add(k); return true; });
}
function fetchJson(url) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 10000);
  return fetch(url, { signal: ctl.signal }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).finally(() => clearTimeout(t));
}
// Cached list for a country+year, or null (and a background fetch starts) if we don't have it yet.
function remoteList(cc, year) {
  const rec = _store[`${cc}:${year}`];
  if (!rec || Date.now() - rec.at > HOL_TTL) fetchHolidays(cc, year);
  return rec ? rec.list : null;
}
function fetchHolidays(cc, year) {
  const k = `${cc}:${year}`;
  if (COUNTRIES[cc]) return Promise.resolve(null);
  if (_inflight[k]) return _inflight[k];
  if (_failed[k]) return Promise.resolve(null);
  return _inflight[k] = fetchJson(`${NAGER}/PublicHolidays/${year}/${cc}`)
    .then(raw => { const list = normalizeHolidays(raw); _store[k] = { at: Date.now(), list }; try { localStorage.setItem(HOL_KEY, JSON.stringify(_store)); } catch {} return list; })
    .catch(() => { _failed[k] = true; return null; })
    .then(list => { delete _inflight[k]; window.dispatchEvent(new Event('holidays-updated')); return list; });
}
const prefetchHolidays = cc => { if (cc && !COUNTRIES[cc]) { const y = new Date().getFullYear(); [y - 1, y, y + 1].forEach(v => fetchHolidays(cc, v)); } };
const holidaysFailed = (cc, year) => !!_failed[`${cc}:${year}`];
// Holidays for the chosen country/region/year as [{date, name}], or null while they are still loading.
function holidayList(cc, region, year) {
  if (COUNTRIES[cc]) return COUNTRIES[cc].holidays(year);
  const list = remoteList(cc, year);
  return list ? list.filter(x => !x.regions || (region && x.regions.includes(region))) : null;
}
// Regions that have holidays of their own (empty until the country's data has loaded).
function regionsFor(cc, year) {
  const list = COUNTRIES[cc] ? [] : (_store[`${cc}:${year}`] || {}).list || [];
  return [...new Set(list.flatMap(x => x.regions || []))].sort((a, b) => regionLabel(a).localeCompare(regionLabel(b)));
}
async function loadCountryList() {
  let rec; try { rec = JSON.parse(localStorage.getItem(CTRY_KEY)); } catch {}
  if (!rec || Date.now() - rec.at > HOL_TTL) {
    try {
      const j = await fetchJson(`${NAGER}/AvailableCountries`);
      rec = { at: Date.now(), list: j.map(c => ({ code: c.countryCode, name: c.name })) };
      try { localStorage.setItem(CTRY_KEY, JSON.stringify(rec)); } catch {}
    } catch {}
  }
  const map = new Map((rec ? rec.list : []).map(c => [c.code, c.name]));
  for (const [code, c] of Object.entries(COUNTRIES)) map.set(code, c.name);
  for (const [code, name] of map) _names[code] = name;
  return [...map].map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name));
}
const countryName = cc => (COUNTRIES[cc] && COUNTRIES[cc].name) || _names[cc] || cc;
