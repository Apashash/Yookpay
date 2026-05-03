export function formatCurrency(amount: number, currency: string): string {
  if (currency === 'USDT') {
    const decimals = Number(amount) < 0.01 ? 8 : Number(amount) < 1 ? 4 : 2;
    return `${Number(amount).toFixed(decimals)} USDT`;
  }
  const formattedAmount = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(amount);

  switch (currency) {
    case 'XAF':
      return `FCFA ${formattedAmount}`;
    case 'XOF':
      return `CFA ${formattedAmount}`;
    case 'CDF':
      return `FC ${formattedAmount}`;
    default:
      return `${currency} ${formattedAmount}`;
  }
}

export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(dateString));
}
