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

const decodeReferenceFn = (value: string): ProjectVersionReference =>
	value === "current"
		? currentReference
		: {
				type: "version",
				versionId: value,
			};

interface VersionComparisonProps {
	readonly currentBaseVersionId: string | undefined;
	readonly currentFingerprint: string | undefined;
	readonly enabled: boolean;
	readonly projectId: string;
	readonly reportErrorFn: (error: unknown) => void;
}

interface VersionComparisonOutput {
	readonly compareFrom: string;
	readonly compareTo: string;
	readonly compareVersionFn: (version: ProjectVersionDescriptor) => void;
	readonly diff?: ProjectVersionDiff;
	readonly pending: boolean;
	readonly resetToBaseFn: () => void;
	readonly setCompareFromFn: (value: string) => void;
	readonly setCompareToFn: (value: string) => void;
}

/** Owns the arbitrary saved-version versus working-copy comparison. */
export const useVersionComparison = ({
	currentBaseVersionId,
	currentFingerprint,
	enabled,
	projectId,
	reportErrorFn,
}: VersionComparisonProps): VersionComparisonOutput => {
	const [compareFromOverride, setCompareFromFn] = useState<string>();
	const [compareTo, setCompareToFn] = useState("current");
	const compareFrom = compareFromOverride ?? currentBaseVersionId ?? "current";
	const [diff, setDiffFn] = useState<ProjectVersionDiff>();
	const [pending, setPendingFn] = useState(false);

	useEffect(() => {
		if (!enabled) return;
		let mounted = true;
		setPendingFn(true);
		void RendererRuntime.runPromise(
			Effect.flatMap(ProjectRepository, (repository) =>
				repository.diffVersionsFx({
					projectId,
					from: decodeReferenceFn(compareFrom),
					to: decodeReferenceFn(compareTo),
				}),
			),
		)
			.then((next) => {
				if (!mounted) return;
				setDiffFn(next);
				setPendingFn(false);
			})
			.catch((cause) => {
				if (!mounted) return;
				reportErrorFn(cause);
				setDiffFn(undefined);
				setPendingFn(false);
			});
		return () => {
			mounted = false;
		};
	}, [
		compareFrom,
		compareTo,
		currentFingerprint,
		enabled,
		projectId,
		reportErrorFn,
	]);

	const compareVersionFn = useCallback((version: ProjectVersionDescriptor) => {
		setCompareFromFn(version.parentVersionId ?? version.versionId);
		setCompareToFn(version.versionId);
	}, []);
	const resetToBaseFn = useCallback(() => {
		setCompareFromFn(undefined);
		setCompareToFn("current");
	}, []);

	return {
		compareFrom,
		compareTo,
		compareVersionFn,
		...(diff === undefined
			? {}
			: {
					diff,
				}),
		pending,
		resetToBaseFn,
		setCompareFromFn,
		setCompareToFn,
	};
};
