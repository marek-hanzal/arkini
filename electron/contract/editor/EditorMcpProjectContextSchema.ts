import { z } from "zod";

/** The exact editor project identity published by the mounted renderer workspace. */
export const EditorMcpProjectContextSchema = z.string().min(1);
