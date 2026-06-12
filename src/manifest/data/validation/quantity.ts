import type { Quantity } from "../producer";
import { assert } from "./assert";

export function assertQuantity(quantity: Quantity, label: string) {
  if (typeof quantity === "number") {
    assert(quantity > 0, `${label} must be positive`);
    return;
  }
  assert(quantity.min > 0 && quantity.max >= quantity.min, `${label} range is invalid`);
}
