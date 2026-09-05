import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { useMemo, type PropsWithChildren } from "react";
import { createDraftFn } from "~/item-authoring/fn/createDraftFn";
import { convertFn } from "~/item-authoring/fn/convertFn";
import { FormSession } from "~/item-authoring/ui/FormSession";
import { NotFound } from "~/item-authoring/ui/NotFound";
import type { OptionalCapability, SectionId } from "~/item-authoring/type/Section";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { useItemByUid } from "~/item-authoring/ui/useItemByUid";

const useDraft = (type: TypeSchema.Type, uid: string): ItemSchema.Type => {
	const project = useEditorProject();
	return useMemo(() => {
		const draft = createDraftFn({
			resourceId: project.resources[0]?.id ?? "missing-asset",
			type,
			uid,
		});
		if (draft.type !== "blueprint") return draft;
		return {
			...draft,
			charges: {
				amount: 1,
			},
			line: {
				...draft.line,
				input: [
					{
						type: "deposit",
						charges: {
							cost: 1,
							from: "self",
						},
						query: {
							scope: "board",
							distance: "self",
							selector: {
								type: "item",
								itemId: draft.id,
							},
						},
					},
				],
			},
		} satisfies ItemSchema.Type;
	}, [
		project.resources,
		type,
		uid,
	]);
};

interface FormProps extends PropsWithChildren {
	readonly enableCapability?: OptionalCapability;
	readonly itemType?: TypeSchema.Type;
	readonly mergeIndex?: number;
	readonly productionLineId?: string;
	readonly sectionId?: SectionId;
	readonly uid: string;
}

/** Resolves a canonical item by UID or seeds its first local form from itemType. */
export const Form = ({
	children,
	enableCapability,
	itemType,
	mergeIndex,
	productionLineId,
	sectionId = "identity",
	uid,
}: FormProps) => {
	const persistedItem = useItemByUid(uid);
	const draft = useDraft(itemType ?? persistedItem?.type ?? "simple", uid);
	if (persistedItem === undefined && itemType === undefined) return <NotFound uid={uid} />;
	const initialItem =
		persistedItem === undefined
			? draft
			: itemType === undefined
				? persistedItem
				: convertFn(persistedItem, itemType);
	const isNew = persistedItem === undefined;
	return (
		<FormSession
			key={`${initialItem.uid}:${initialItem.type}`}
			enableCapability={enableCapability}
			initialItem={initialItem}
			isNew={isNew}
			itemType={itemType}
			mergeIndex={mergeIndex}
			productionLineId={productionLineId}
			sectionId={sectionId}
		>
			{children}
		</FormSession>
	);
};
