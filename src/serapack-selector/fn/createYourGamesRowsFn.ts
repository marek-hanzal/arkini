import type { ProjectCandidate } from "~/project-authoring/schema/ProjectCandidateSchema";
import type { SerapackDescriptor } from "~/serapack-catalog/type/SerapackDescriptor";

export type YourGamesRow =
	| {
			readonly type: "project";
			readonly candidate: Extract<
				ProjectCandidate,
				{
					type: "valid";
				}
			>;
			readonly serapack: SerapackDescriptor | undefined;
	  }
	| {
			readonly type: "serapack";
			readonly serapack: SerapackDescriptor;
	  }
	| {
			readonly type: "invalid-project";
			readonly candidate: Extract<
				ProjectCandidate,
				{
					type: "invalid";
				}
			>;
	  };

/** Joins by canonical game ID while keeping the Editor's recent-project order. */
export const createYourGamesRowsFn = (
	projects: ReadonlyArray<ProjectCandidate>,
	serapacks: ReadonlyArray<SerapackDescriptor>,
): ReadonlyArray<YourGamesRow> => {
	const packagesById = new Map(
		serapacks.map((serapack) => [
			serapack.packageId,
			serapack,
		]),
	);
	const rows: YourGamesRow[] = [];
	for (const candidate of projects) {
		if (candidate.type === "invalid") continue;
		rows.push({
			type: "project",
			candidate,
			serapack: packagesById.get(candidate.project.projectId),
		});
		packagesById.delete(candidate.project.projectId);
	}
	for (const serapack of [
		...packagesById.values(),
	].sort(
		(left, right) =>
			left.title.localeCompare(right.title) || left.packageId.localeCompare(right.packageId),
	))
		rows.push({
			type: "serapack",
			serapack,
		});
	for (const candidate of projects) {
		if (candidate.type === "invalid")
			rows.push({
				type: "invalid-project",
				candidate,
			});
	}
	return rows;
};
