import type { LineView } from "~/board/view/LineViewSchema";

const readEffectRequirementPrefix = (
	requirement: NonNullable<LineView["effectRequirements"]>[number],
) => (requirement.kind === "grant.blockStart" ? "Blocked by" : "Missing");

const readVisibleEffectRequirements = (line: LineView) =>
	(line.effectRequirements ?? []).filter((requirement) => !requirement.ready);

export const readDetailLineEffectRequirementSummary = (line: LineView) => {
	const visibleRequirements = readVisibleEffectRequirements(line);
	const title = visibleRequirements.some((requirement) => requirement.kind === "grant.blockStart")
		? "Blocked effects"
		: "Missing effects";
	const labels = visibleRequirements.map(
		(requirement) => `${readEffectRequirementPrefix(requirement)} ${requirement.label}`,
	);

	return {
		labels,
		title,
	};
};
