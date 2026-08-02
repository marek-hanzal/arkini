import { EditorProjectBoardSection } from "~/ui/project/editor/EditorProjectBoardSection";
import { EditorProjectInventorySection } from "~/ui/project/editor/EditorProjectInventorySection";
import { EditorProjectToolbarSection } from "~/ui/project/editor/EditorProjectToolbarSection";

export const EditorProjectSurfacesSection = () => (
	<div className="grid gap-6">
		<EditorProjectBoardSection />
		<EditorProjectInventorySection />
		<EditorProjectToolbarSection />
	</div>
);
