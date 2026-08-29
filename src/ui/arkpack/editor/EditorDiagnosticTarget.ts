import type { EditorItemSectionId } from "~/item-authoring/ui/EditorItemSections";
import type { EditorProjectSectionId } from "~/ui/project/editor/EditorProjectSections";

export type EditorDiagnosticTarget =
	| {
			readonly kind: "item";
			readonly itemUid: string;
			readonly sectionId: EditorItemSectionId;
			readonly label: string;
	  }
	| {
			readonly kind: "asset";
			readonly resourceId: string;
			readonly label: string;
	  }
	| {
			readonly kind: "project";
			readonly sectionId: EditorProjectSectionId;
			readonly label: string;
	  };
