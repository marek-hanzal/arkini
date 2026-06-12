import type { Quantity } from "~/manifest/data/producer";

export function resolveProducerDropQuantity(quantity: Quantity) {
  if (typeof quantity === "number") return quantity;
  return quantity.min + Math.floor(Math.random() * (quantity.max - quantity.min + 1));
}
