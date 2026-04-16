interface Order {
  id: string;
  customerName: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  shippingAddress: string;
  email: string;
}

interface ProcessedOrder extends Order {
  total: number;
  status: string;
  processedAt: Date;
}

export function processOrder(order: Order): ProcessedOrder {
  // --- Input validation block (extract this) ---
  if (!order.id || order.id.trim() === "") {
    throw new Error("Order ID is required");
  }
  if (!order.customerName || order.customerName.trim().length < 2) {
    throw new Error("Customer name must be at least 2 characters");
  }
  if (!order.items || order.items.length === 0) {
    throw new Error("Order must contain at least one item");
  }
  for (const item of order.items) {
    if (item.quantity < 1) {
      throw new Error(`Invalid quantity for item: ${item.name}`);
    }
    if (item.price < 0) {
      throw new Error(`Invalid price for item: ${item.name}`);
    }
  }
  if (!order.email || !order.email.includes("@")) {
    throw new Error("Valid email is required");
  }
  if (!order.shippingAddress || order.shippingAddress.trim().length < 10) {
    throw new Error("Shipping address must be at least 10 characters");
  }
  // --- End validation block ---

  const total = order.items.reduce(
    (sum, item) => sum + item.quantity * item.price,
    0
  );

  return {
    ...order,
    total,
    status: "processed",
    processedAt: new Date(),
  };
}
