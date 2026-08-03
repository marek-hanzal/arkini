import { useCallback, useState } from "react";

import type {
	InlineLineDraft,
	InlineLineDraftErrors,
	InlineLineDraftField,
} from "~/ui/item/editor/EditorProductionLineInlineDraft";

/** Owns the local-only lifecycle shared by inline line create and edit modes. */
export const useEditorProductionLineDraft = () => {
	const [draft, setDraft] = useState<InlineLineDraft>();
	const [errors, setErrors] = useState<InlineLineDraftErrors>({});
	const updateDraft = useCallback((field: InlineLineDraftField, value: string) => {
		setDraft((current) =>
			current === undefined
				? current
				: {
						...current,
						[field]: value,
					},
		);
		setErrors((current) => ({
			...current,
			[field]: undefined,
		}));
	}, []);
	const discard = useCallback(() => {
		setDraft(undefined);
		setErrors({});
	}, []);
	const start = useCallback((initialDraft: InlineLineDraft) => {
		setDraft(initialDraft);
		setErrors({});
	}, []);
	return {
		discard,
		draft,
		errors,
		setErrors,
		start,
		updateDraft,
	} as const;
};
