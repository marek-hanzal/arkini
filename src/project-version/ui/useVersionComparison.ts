import { Effect } from "effect";
import { useCallback, useEffect, useState } from "react";

import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type {
	ProjectVersionDescriptor,
	ProjectVersionDiff,
	ProjectVersionReference,
} from "~/project-version/type/ProjectVersion";

const currentReference: ProjectVersionReference = {
	type: "current",
};

const decodeReference = (value: string): ProjectVersionReference =>
	value === "current"
		? currentReference
		: {
				type: "version",
				versionId: value,
			};

interface VersionComparisonProps {
	readonly enabled: boolean;
	readonly projectId: string;
	readonly reportError: (error: unknown) => void;
}

interface VersionComparisonOutput {
	readonly compareFrom: string;
	readonly compareTo: string;
	readonly compareVersion: (version: ProjectVersionDescriptor) => void;
	readonly diff?: ProjectVersionDiff;
	readonly pending: boolean;
	readonly resetToBase: (versionId?: string) => void;
	readonly setCompareFrom: (value: string) => void;
	readonly setCompareTo: (value: string) => void;
}

/** Owns the arbitrary saved-version versus working-copy comparison. */
export const useVersionComparison = ({
	enabled,
	projectId,
	reportError,
}: VersionComparisonProps): VersionComparisonOutput => {
	const [compareFrom, setCompareFrom] = useState("current");
	const [compareTo, setCompareTo] = useState("current");
	const [diff, setDiff] = useState<ProjectVersionDiff>();
	const [pending, setPending] = useState(false);

	useEffect(() => {
		if (!enabled) return;
		let mounted = true;
		setPending(true);
		void RendererRuntime.runPromise(
			Effect.flatMap(ProjectRepository, (repository) =>
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

	const compareVersion = useCallback((version: ProjectVersionDescriptor) => {
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
