import { callRpc, markNotificationReadAction } from "@/app/actions";
import type { Client } from "@/lib/rpc";

/**
 * The browser's Client for lib/rpc.ts. Each call is a server action, which
 * looks up the session and runs the function as that user under RLS — the
 * browser holds no database credential at all.
 */
const client = {
  rpc: (name: string, args?: Record<string, unknown>) => callRpc(name, args),
  markNotificationRead: (id: string) => markNotificationReadAction(id),
} as Client;

export function createClient(): Client {
  return client;
}
