import type { SpaceDestinationSchema } from "~/space/schema/SpaceDestinationSchema";
import type { TemplateSchema } from "~/board-template/schema/TemplateSchema";

/** Labels authored destination recipes without pretending they resolve to a runtime address. */
export const readSpaceDestinationLabelFn = (
	space: SpaceDestinationSchema.Type,
	textFn: (key: string) => string,
	templates?: readonly TemplateSchema.Type[],
): string => {
	if (space === "previous") return textFn("Previous Space");
	if (typeof space === "number") return `${textFn("Space")} ${space}`;
	return `${textFn("Inventory")} · ${templates?.find(({ uid }) => uid === space.templateUid)?.title ?? space.templateUid}`;
};
