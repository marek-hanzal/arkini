import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

/** A recycled numeric address cannot retain a reference to its previous Inventory owner. */
export const isSpaceRetainedFn = ({
	space,
	previousRuntime,
	runtime,
}: {
	readonly space: number;
	readonly previousRuntime: RuntimeSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}): boolean => {
	const owner = previousRuntime.items.find((item) =>
		Object.values(item.inventories ?? {}).includes(space),
	);
	return (
		owner === undefined ||
		runtime.items.some(
			(item) => item.id === owner.id && Object.values(item.inventories ?? {}).includes(space),
		)
	);
};
