import { match } from "ts-pattern";
import type { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { useTranslator } from "~/translation/ui/useTranslator";

interface EditorResourceOptimizationLabelProps {
	readonly pending: boolean;
	readonly phase: ProjectRepository.OptimizeResourcesProgress["phase"] | undefined;
	readonly percent: number;
}

/** Shared optimization action copy; each resource owner projects its own progress. */
export const EditorResourceOptimizationLabel = (props: EditorResourceOptimizationLabelProps) => {
	const translator = useTranslator();
	return match(props)
		.with(
			{
				pending: false,
			},
			() => translator.textFn("Optimize"),
		)
		.with(
			{
				phase: "saving",
			},
			() => translator.textFn("Saving…"),
		)
		.otherwise(({ percent }) => `${translator.textFn("Optimizing")} ${percent}%`);
};
