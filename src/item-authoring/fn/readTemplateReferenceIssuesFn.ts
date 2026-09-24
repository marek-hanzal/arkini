import type { TemplateSchema } from "~/board-template/schema/TemplateSchema";
import { readItemTemplateReferencesFn } from "~/game-config-validation/fn/readItemTemplateReferencesFn";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

/** Item-local paths shared by form feedback and repository write admission. */
export const readTemplateReferenceIssuesFn = (
	item: ItemSchema.Type,
	templates: ReadonlyArray<TemplateSchema.Type> = [],
): readonly readItemTemplateReferencesFn.Reference[] =>
	readItemTemplateReferencesFn(item).filter(
		({ templateUid }) => !templates.some(({ uid }) => uid === templateUid),
	);
