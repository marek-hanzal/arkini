import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { SizeSchema } from "~/item-location/schema/SizeSchema";

/** Loaded configuration owns dimensions; unmapped spaces use the project default. */
export const readBoardSizeFn = ({
	config,
	runtime,
	space,
}: {
	readonly config: GameConfigSchema.Type;
	readonly space: number;
	readonly runtime: RuntimeSchema.Type;
}): SizeSchema.Type => {
	const templateUid = runtime.templateUidBySpace[space];
	const template =
		templateUid === undefined
			? undefined
			: config.templates?.find((entry) => entry.uid === templateUid);
	return template === undefined
		? config.meta.board
		: {
				width: template.width,
				height: template.height,
			};
};
