/**
 * Currency list and formatter shared by every tool that lets you pick one.
 */

export const CURRENCIES = [
  { code: 'NOK', locale: 'nb-NO' },
  { code: 'USD', locale: 'en-US' },
  { code: 'EUR', locale: 'de-DE' },
  { code: 'GBP', locale: 'en-GB' },
  { code: 'SEK', locale: 'sv-SE' },
  { code: 'DKK', locale: 'da-DK' },
];

/**
 * @param {string} code one of CURRENCIES' codes
 * @returns {(n: number) => string} formats a number in that currency, rounded to whole units
 */
export function buildFormatter(code) {
  const currency = CURRENCIES.find((c) => c.code === code) || CURRENCIES[0];
  const formatter = new Intl.NumberFormat(currency.locale, {
    style: 'currency',
    currency: currency.code,
    maximumFractionDigits: 0,
  });
  return (n) => formatter.format(Math.round(n || 0));
}
