/**
 * Normalize input date string to yyyy-mm-dd.
 * Accepts either yyyy-mm-dd or dd-mm-yyyy; returns yyyy-mm-dd.
 */
function normalizeDateToYmd(dateStr) {
  if (!dateStr) return dateStr;
  const ddmmyyyyPattern = /^(\d{2})-(\d{2})-(\d{4})$/;
  const match = dateStr.match(ddmmyyyyPattern);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }
  return dateStr;
}

module.exports = {
  normalizeDateToYmd
};


