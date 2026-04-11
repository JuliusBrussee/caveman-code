export function calculateDiscount(price: number, percentage: number): number {
	if (percentage < 0 || percentage > 100) {
		throw new Error("Percentage must be between 0 and 100");
	}
	return price * (1 - percentage / 100);
}

export function formatCurrency(amount: number, currency = "USD"): string {
	return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

export function applyTax(price: number, taxRate: number): number {
	return price * (1 + taxRate);
}
