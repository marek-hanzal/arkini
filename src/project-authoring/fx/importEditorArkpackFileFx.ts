import { Effect } from "effect";

import { invokeProjectTransportFx } from "~/project-authoring/fx/invokeProjectTransportFx";
import { ProjectDescriptorSchema } from "~/project-authoring/schema/ProjectDescriptorSchema";

/** Lets main select and stream-import one Arkpack into a managed Editor project. */
export const importEditorArkpackFileFx = Effect.fn("importEditorArkpackFileFx")(() =>
	invokeProjectTransportFx({
		callFn: () => window.arkini.editor.importArkpackFn(),
		operation: "import-arkpack",
		parseFn: (value) => (value === null ? null : ProjectDescriptorSchema.parse(value)),
		requestMessage: "The editor Arkpack import request failed.",
		responseMessage: "The editor Arkpack import response is invalid.",
	}),
);
