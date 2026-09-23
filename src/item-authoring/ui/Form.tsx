import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { useMemo, type PropsWithChildren } from "react";
import { createDraftFn } from "~/item-authoring/fn/createDraftFn";
import { FormSession } from "~/item-authoring/ui/FormSession";
import { NotFound } from "~/item-authoring/ui/NotFound";
import type { OptionalCapability, SectionId } from "~/item-authoring/type/Section";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { useItemByUid } from "~/item-authoring/ui/useItemByUid";

const useDraft = (
	defaultDraft: boolean | undefined,
	defaultTitle: string | undefined,
	uid: string,
	resourceUid?: string,
): ItemSchema.Type => {
	const project = useEditorProject();
	return useMemo(() => {
		const draft = createDraftFn({
			draft: defaultDraft,
			resourceUid:
				resourceUid ??
				project.resources.find(({ type }) => type === "artwork")?.uid ??
				"missing-artwork",
			uid,
		});
		const namedDraft =
			defaultTitle === undefined
				? draft
				: {
						...draft,
						title: defaultTitle,
					};
		return namedDraft;
	}, [
		defaultDraft,
		defaultTitle,
		project.resources,
		resourceUid,
		uid,
	]);
};

interface FormProps extends PropsWithChildren {
	readonly defaultDraft?: boolean;
	readonly defaultTitle?: string;
	readonly enableCapability?: OptionalCapability;
	readonly create?: boolean;
	readonly inputIndex?: number;
	readonly ruleIndex?: number;
	readonly whenIndex?: number;
	readonly mergeIndex?: number;
	readonly outcomeSetIndex?: number;
	readonly outcomeRollIndex?: number;
	readonly outcomeIndex?: number;
	readonly productionLineId?: string;
	readonly productionLineIndex?: number;
	readonly resourceUid?: string;
	readonly sectionId?: SectionId;
	readonly uid: string;
}

/** Resolves a canonical item by UID or seeds its first local form from create. */
export const Form = ({
	children,
	defaultDraft,
	defaultTitle,
	enableCapability,
	create,
	inputIndex,
	ruleIndex,
	whenIndex,
	mergeIndex,
	outcomeSetIndex,
	outcomeRollIndex,
	outcomeIndex,
	productionLineId,
	productionLineIndex,
	resourceUid,
	sectionId = "identity",
	uid,
}: FormProps) => {
	const draft = useDraft(defaultDraft, defaultTitle, uid, resourceUid);
	const persistedItem = useItemByUid(uid);
	if (persistedItem === undefined && create !== true) return <NotFound uid={uid} />;
	const initialItem = persistedItem ?? draft;
	const isNew = persistedItem === undefined;
	return (
		<FormSession
			key={initialItem.uid}
			defaultDraft={defaultDraft}
			defaultTitle={defaultTitle}
			enableCapability={enableCapability}
			initialItem={initialItem}
			isNew={isNew}
			create={create}
			inputIndex={inputIndex}
			ruleIndex={ruleIndex}
			whenIndex={whenIndex}
			mergeIndex={mergeIndex}
			outcomeSetIndex={outcomeSetIndex}
			outcomeRollIndex={outcomeRollIndex}
			outcomeIndex={outcomeIndex}
			productionLineId={productionLineId}
			productionLineIndex={productionLineIndex}
			resourceUid={resourceUid}
			sectionId={sectionId}
		>
			{children}
		</FormSession>
	);
};
