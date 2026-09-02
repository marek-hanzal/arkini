import { bumpArkpackVersionFn } from "~/project-version/fn/bumpArkpackVersionFn";
import type {
	ProjectVersionCommitPreview,
	ProjectVersionDiff,
} from "~/project-version/type/ProjectVersion";
import type { VersionSchema as GameVersionSchema } from "~/game-version/schema/VersionSchema";

const readBumpFn = (diff: ProjectVersionDiff) => {
	const bumps = [
		...diff.project.map(({ bump }) => bump),
		...diff.items.flatMap(({ values }) => values.map(({ bump }) => bump)),
		...diff.resources.map(({ bump }) => bump),
	];
	return bumps.includes("major") ? "major" : bumps.includes("minor") ? "minor" : "noop";
};

export const createProjectVersionCommitPreviewFn = ({
	baseArkpackVersion,
	currentFingerprint,
	currentScenarioNames,
	diff,
}: {
	readonly baseArkpackVersion: GameVersionSchema.Type;
	readonly currentFingerprint: string;
	readonly currentScenarioNames: ReadonlyArray<string>;
	readonly diff?: ProjectVersionDiff;
}): ProjectVersionCommitPreview => {
	const bump = diff === undefined ? "noop" : readBumpFn(diff);
	return {
		bump,
		canCommit: diff?.hasChanges ?? true,
		currentFingerprint,
		...(diff === undefined
			? {}
			: {
					diff,
				}),
		initial: diff === undefined,
		nextArkpackVersion: bumpArkpackVersionFn(baseArkpackVersion, bump),
		scenariosToDelete:
			bump === "major"
				? [
						...currentScenarioNames,
					].sort()
				: [],
	};
};
