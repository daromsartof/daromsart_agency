import "server-only";
import { createStorage } from "@daromsart/storage";
import { env } from "./env";

export const storage = createStorage(env);
