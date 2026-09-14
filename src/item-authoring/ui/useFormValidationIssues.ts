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
export const useFormValidationIssues = (value: object | undefined) => {
	const { form, validationIssues } = useFormSession();
	const values = useStore(form.store, (state) => state.values);
	return useMemo(() => {
		if (value === undefined) return [];
		const path = readValuePathFn(values, value);
		return path === undefined ? [] : readEditorFormValidationIssuesFn(validationIssues, path);
	}, [
		validationIssues,
		value,
		values,
	]);
};

/** Selects a collection item only when it contains the form's current validation target. */
export const useFormValidationFocusIndex = (
	value: object | undefined,
	...collectionPath: ReadonlyArray<PropertyKey>
) => {
	const { form, validationIssues } = useFormSession();
	const values = useStore(form.store, (state) => state.values);
	return useMemo(() => {
		if (value === undefined) return undefined;
		const valuePath = readValuePathFn(values, value);
		const issue = validationIssues[0];
		if (valuePath === undefined || issue === undefined) return undefined;
		const prefix = [
			...valuePath,
			...collectionPath,
		];
		if (!prefix.every((segment, index) => issue.path[index] === segment)) return undefined;
		const index = issue.path[prefix.length];
		return typeof index === "number" ? index : undefined;
	}, [
		collectionPath,
		validationIssues,
		value,
		values,
	]);
};
