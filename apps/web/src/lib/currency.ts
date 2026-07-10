const nokFormatter = new Intl.NumberFormat('nb-NO', {
  style: 'currency',
  currency: 'NOK',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export function formatNokFromOre(ore: number) {
  return nokFormatter.format(ore / 100);
}

export function oreToNokInputValue(ore: number) {
  return (ore / 100).toFixed(2);
}

export function parseNokInputToOre(value: string) {
  const normalized = value.replace(',', '.').trim();
  const numberValue = Number(normalized);
  if (!Number.isFinite(numberValue)) {
    return 0;
  }

  return Math.round(numberValue * 100);
}