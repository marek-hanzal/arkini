import type { SerapackStorage } from "~/serapack-catalog/service/SerapackStorage";

const sourcePriority = {
	user: 0,
	bundled: 1,
} satisfies Record<SerapackStorage.Candidate["source"], number>;

/** Prefers user packages while preserving discovery order within each source. */
export const compareSerapackSourcesFn = (
	left: SerapackStorage.Candidate["source"],
	right: SerapackStorage.Candidate["source"],
) => sourcePriority[left] - sourcePriority[right];
