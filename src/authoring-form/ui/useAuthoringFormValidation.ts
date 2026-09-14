import { useMemo } from "react";
import type { z } from "zod";

import { readEditorFormValidationMessageFn } from "~/editor-control/fn/readEditorFormValidationMessageFn";
import type { EditorFormValidationIssue } from "~/editor-control/type/EditorFormValidationIssue";
import { useTranslator } from "~/translation/ui/useTranslator";

export namespace useAuthoringFormValidation {
	export interface Props {
		readonly readMessageFn?: (issue: z.core.$ZodIssue) => string;
		readonly schema: z.ZodType;
		readonly submissionAttempts: number;
		readonly values: unknown;
	}
}

/** Projects live correction messages only after the form's first submission attempt. */
export const useAuthoringFormValidation = ({
	readMessageFn,
	schema,
	submissionAttempts,
	values,
}: useAuthoringFormValidation.Props): ReadonlyArray<EditorFormValidationIssue> => {
	const translator = useTranslator();
	return useMemo(() => {
		if (submissionAttempts === 0) return [];
		const result = schema.safeParse(values);
		return result.success
			? []
			: result.error.issues.map((issue) => ({
					message:
						readMessageFn?.(issue) ??
						readEditorFormValidationMessageFn(issue, translator.textFn),
					path: issue.path,
				}));
	}, [
		readMessageFn,
		schema,
		submissionAttempts,
		translator,
		values,
	]);
};
