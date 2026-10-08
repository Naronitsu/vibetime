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
