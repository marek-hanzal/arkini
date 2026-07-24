import { Effect, Option, SubscriptionRef } from "effect";
import type { ArkpackCatalog } from "~/bridge/arkpack/ArkpackCatalog";

export namespace publishArkpackCatalogStateFx {
	export interface Props {
		readonly state: SubscriptionRef.SubscriptionRef<ArkpackCatalog.State>;
		readonly next: ArkpackCatalog.State;
	}
}

/** Publishes a changed authoritative catalog state without duplicating loading. */
export const publishArkpackCatalogStateFx = Effect.fn("publishArkpackCatalogStateFx")(
	({ state, next }: publishArkpackCatalogStateFx.Props) =>
		SubscriptionRef.modifySome(
			state,
			(current) =>
				[
					undefined,
					current === next || (current.type === "loading" && next.type === "loading")
						? Option.none()
						: Option.some(next),
				] as const,
		),
);
