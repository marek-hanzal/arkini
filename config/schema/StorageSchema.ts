import { z } from "zod";

export const StorageSchema = z.enum(["board", "inventory", "both"]);
