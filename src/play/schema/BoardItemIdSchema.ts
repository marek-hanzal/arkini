import { z } from "zod";

export const BoardItemIdSchema = z.string().min(1);
