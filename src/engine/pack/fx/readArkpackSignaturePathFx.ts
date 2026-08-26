import { Effect } from "effect";

/** Derives the canonical detached `.arksig` sibling from one `.arkpack` path. */
export const readArkpackSignaturePathFx = Effect.fn("readArkpackSignaturePathFx")(
	(arkpackPath: string) =>
		Effect.succeed(
			arkpackPath.endsWith(".arkpack")
				? `${arkpackPath.slice(0, -".arkpack".length)}.arksig`
				: `${arkpackPath}.arksig`,
		),
);
