import { useMemo } from "react";
import type { z } from "zod";

import { readEditorFormValidationMessageFn } from "~/editor-control/fn/readEditorFormValidationMessageFn";
import type { EditorFormValidationIssue } from "~/editor-control/type/EditorFormValidationIssue";

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
	readMessageFn = readEditorFormValidationMessageFn,
	schema,
	submissionAttempts,
	values,
}: useAuthoringFormValidation.Props): ReadonlyArray<EditorFormValidationIssue> =>
	useMemo(() => {
		if (submissionAttempts === 0) return [];
		const result = schema.safeParse(values);
		return result.success
			? []
			: result.error.issues.map((issue) => ({
					message: readMessageFn(issue),
					path: issue.path,
				}));
	}, [
		readMessageFn,
		schema,
		submissionAttempts,
		values,
	]);
