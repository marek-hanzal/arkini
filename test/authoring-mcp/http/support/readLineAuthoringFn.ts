import type { LineSchema } from "~/production-line/schema/LineSchema";

/** Canonical reads include identity; focused create/replace authoring values deliberately do not. */
export const readLineAuthoringFn = ({ uid: _uid, ...line }: LineSchema.Type) => line;
