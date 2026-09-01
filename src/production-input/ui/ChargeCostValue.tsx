import type { ChargeSchema } from "~/production-input/schema/ChargeSchema";

/** Renders one canonical human-readable charge cost across Editor and Game. */
export const ChargeCostValue = ({ charge }: { readonly charge: ChargeSchema.Type }) => (
	<>
		{charge.cost} charge{charge.cost === 1 ? "" : "s"} from{" "}
		{charge.from === "self" ? "owner" : "target"}
	</>
);
