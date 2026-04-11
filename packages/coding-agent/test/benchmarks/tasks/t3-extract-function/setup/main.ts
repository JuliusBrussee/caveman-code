export function processOrder(items: { name: string; price: number; qty: number }[]) {
	// Calculate total with tax
	let subtotal = 0;
	for (const item of items) {
		subtotal += item.price * item.qty;
	}
	const tax = subtotal * 0.08;
	const total = subtotal + tax;

	// Format line items
	const lines = items.map(
		(item) => `${item.name} x${item.qty} @ $${item.price.toFixed(2)} = $${(item.price * item.qty).toFixed(2)}`,
	);

	// Generate receipt
	const receipt = [
		"=== RECEIPT ===",
		...lines,
		`Subtotal: $${subtotal.toFixed(2)}`,
		`Tax (8%): $${tax.toFixed(2)}`,
		`Total: $${total.toFixed(2)}`,
		"===============",
	].join("\n");

	return { subtotal, tax, total, receipt };
}
