import type { StartSchema } from "~/game-start/schema/StartSchema";
import type { BoardItemSchema } from "~/game-start/schema/BoardItemSchema";
import type { TemplateSchema } from "~/board-template/schema/TemplateSchema";

/** Projects each authored assignment independently; the config validator owns missing references. */
export const readStartBoardFn = ({
	start,
	templates,
}: {
	readonly start: StartSchema.Type;
	readonly templates?: ReadonlyArray<TemplateSchema.Type>;
}): BoardItemSchema.Type[] =>
	start.spaces.flatMap(({ space, templateUid }) =>
		(templates?.find((template) => template.uid === templateUid)?.board ?? []).map((cell) => ({
			...cell,
			space,
		})),
	);
