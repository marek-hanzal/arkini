import type { ProjectVersionDescriptor } from "~/project-version/type/ProjectVersion";

interface VersionGraphRow {
	readonly activeLanes: ReadonlyArray<number>;
	readonly lane: number;
	readonly parentLane?: number;
	readonly version: ProjectVersionDescriptor;
}

export interface VersionGraphLayout {
	readonly laneCount: number;
	readonly rows: ReadonlyArray<VersionGraphRow>;
	readonly workingCopyLane: number;
}

const orderVersionsFn = (
	versions: ReadonlyArray<ProjectVersionDescriptor>,
): ReadonlyArray<ProjectVersionDescriptor> =>
	[
		...versions,
	].sort(
		(left, right) =>
			right.createdAtMs - left.createdAtMs || right.versionId.localeCompare(left.versionId),
	);

/** Assigns stable lanes to one immutable single-parent tree and its working-copy head. */
export const layoutVersionGraphFn = (
	versions: ReadonlyArray<ProjectVersionDescriptor>,
	currentBaseVersionId?: string,
): VersionGraphLayout => {
	const active: Array<string | undefined> =
		currentBaseVersionId === undefined
			? []
			: [
					currentBaseVersionId,
				];
	let laneCount = Math.max(1, active.length);
	const rows = orderVersionsFn(versions).map((version): VersionGraphRow => {
		let lane = active.indexOf(version.versionId);
		if (lane < 0) {
			const emptyLane = active.indexOf(undefined);
			lane = emptyLane < 0 ? active.length : emptyLane;
			active[lane] = version.versionId;
		}
		const activeLanes = active.flatMap((value, index) =>
			value === undefined
				? []
				: [
						index,
					],
		);
		let parentLane: number | undefined;
		if (version.parentVersionId === undefined) active[lane] = undefined;
		else {
			const existingParentLane = active.indexOf(version.parentVersionId);
			if (existingParentLane < 0) {
				active[lane] = version.parentVersionId;
				parentLane = lane;
			} else {
				active[lane] = undefined;
				parentLane = existingParentLane;
			}
		}
		laneCount = Math.max(laneCount, active.length, lane + 1, (parentLane ?? 0) + 1);
		return {
			activeLanes,
			lane,
			...(parentLane === undefined
				? {}
				: {
						parentLane,
					}),
			version,
		};
	});
	return {
		laneCount,
		rows,
		workingCopyLane: 0,
	};
};
