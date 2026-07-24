"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Client Better Auth (composants React). `baseURL` non précisé : les requêtes
 * ciblent l'origine courante (`/api/auth/*`).
 */
export const authClient = createAuthClient();

export const {
  signIn,
  signOut,
  useSession,
  forgetPassword,
  resetPassword,
  changePassword,
  updateUser,
} = authClient;
