import { Effect } from "effect";
import { useCallback, useEffect, useState } from "react";

import { EditorProjectRepository } from "~/project-authoring/repository/EditorProjectRepository";
import { RendererRuntime } from "~/renderer/RendererRuntime";
import type {
	EditorProjectVersionDescriptor,
	EditorProjectVersionDiff,
	EditorProjectVersionReference,
} from "~/project-version/EditorProjectVersion";

const currentReference: EditorProjectVersionReference = {
	type: "current",
};

const decodeReference = (value: string): EditorProjectVersionReference =>
	value === "current"
		? currentReference
		: {
				type: "version",
				versionId: value,
			};

export namespace useEditorVersionComparison {
	export interface Props {
		readonly enabled: boolean;
		readonly projectId: string;
		readonly reportError: (error: unknown) => void;
	}

	export interface Output {
		readonly compareFrom: string;
		readonly compareTo: string;
		readonly compareVersion: (version: EditorProjectVersionDescriptor) => void;
		readonly diff?: EditorProjectVersionDiff;
		readonly pending: boolean;
		readonly resetToBase: (versionId?: string) => void;
		readonly setCompareFrom: (value: string) => void;
		readonly setCompareTo: (value: string) => void;
	}
}

/** Owns the arbitrary saved-version versus working-copy comparison. */
export const useEditorVersionComparison = ({
	enabled,
	projectId,
	reportError,
}: useEditorVersionComparison.Props): useEditorVersionComparison.Output => {
	const [compareFrom, setCompareFrom] = useState("current");
	const [compareTo, setCompareTo] = useState("current");
	const [diff, setDiff] = useState<EditorProjectVersionDiff>();
	const [pending, setPending] = useState(false);

	useEffect(() => {
		if (!enabled) return;
		let mounted = true;
		setPending(true);
		void RendererRuntime.runPromise(
			Effect.flatMap(EditorProjectRepository, (repository) =>
				repository.diffVersionsFx({
					projectId,
					from: decodeReference(compareFrom),
					to: decodeReference(compareTo),
				}),
			),
		)
			.then((next) => {
				if (!mounted) return;
				setDiff(next);
				setPending(false);
			})
			.catch((cause) => {
				if (!mounted) return;
				reportError(cause);
				setDiff(undefined);
				setPending(false);
			});
		return () => {
			mounted = false;
		};
	}, [
		compareFrom,
		compareTo,
		enabled,
		projectId,
		reportError,
	]);

	const compareVersion = useCallback((version: EditorProjectVersionDescriptor) => {
		setCompareFrom(version.parentVersionId ?? version.versionId);
		setCompareTo(version.versionId);
	}, []);
	const resetToBase = useCallback((versionId?: string) => {
		setCompareFrom(versionId ?? "current");
		setCompareTo("current");
	}, []);

	return {
		compareFrom,
		compareTo,
		compareVersion,
		...(diff === undefined
			? {}
			: {
					diff,
				}),
		pending,
		resetToBase,
		setCompareFrom,
		setCompareTo,
	};
};
