export const calculatePrice = ({ distanceKm, baseFeeEtb, perKmFeeEtb, vatRate }) => {
  const totalBeforeVat = baseFeeEtb + (perKmFeeEtb * distanceKm);
  const vatAmount = totalBeforeVat * vatRate;
  const grandTotal = totalBeforeVat + vatAmount;

  return {
    totalBeforeVat: Number(totalBeforeVat.toFixed(2)),
    vatAmount: Number(vatAmount.toFixed(2)),
    grandTotal: Number(grandTotal.toFixed(2))
  };
};
