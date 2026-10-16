import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth/auth";

// Better Auth endpoints (email verification links, password reset callbacks, session API).
export const { GET, POST } = toNextJsHandler(auth);
