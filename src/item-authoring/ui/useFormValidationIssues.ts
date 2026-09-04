import { useStore } from "@tanstack/react-form";
import { useMemo } from "react";

import { readEditorFormValidationIssuesFn } from "~/editor-control/fn/readEditorFormValidationIssuesFn";
import { useFormSession } from "~/item-authoring/ui/FormContext";

const readValuePathFn = (root: object, target: object): ReadonlyArray<PropertyKey> | undefined => {
	const visited = new Set<object>();
	const visitFn = (
		value: unknown,
		path: ReadonlyArray<PropertyKey>,
	): ReadonlyArray<PropertyKey> | undefined => {
		if (value === target) return path;
		if (typeof value !== "object" || value === null || visited.has(value)) return undefined;
		visited.add(value);
		for (const [key, child] of Object.entries(value)) {
			const segment = Array.isArray(value) ? Number(key) : key;
			const found = visitFn(child, [
				...path,
				segment,
			]);
			if (found !== undefined) return found;
		}
		return undefined;
	};
	return visitFn(root, []);
};

/** Reads submitted schema issues relative to one object already present in the item form. */
export const useFormValidationIssues = (value: object) => {
	const { form, validationIssues } = useFormSession();
	const values = useStore(form.store, (state) => state.values);
	return useMemo(() => {
		const path = readValuePathFn(values, value);
		return path === undefined ? [] : readEditorFormValidationIssuesFn(validationIssues, path);
	}, [
		validationIssues,
		value,
		values,
	]);
};
