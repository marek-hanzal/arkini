import { Effect } from "effect";

import { invokeProjectTransportFx } from "~/project-authoring/fx/invokeProjectTransportFx";
import { ProjectDescriptorSchema } from "~/project-authoring/schema/ProjectDescriptorSchema";

/** Lets main select and stream-import one Serapack into a managed Editor project. */
export const importEditorSerapackFileFx = Effect.fn("importEditorSerapackFileFx")(() =>
	invokeProjectTransportFx({
		callFn: () => window.serakki.editor.importSerapackFn(),
		operation: "import-serapack",
		parseFn: (value) => (value === null ? null : ProjectDescriptorSchema.parse(value)),
		requestMessage: "The editor Serapack import request failed.",
		responseMessage: "The editor Serapack import response is invalid.",
	}),
);
