import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { EtapiClient } from "../client/etapi-client.js";
import { failure, success } from "./shared.js";

export function registerGetNote(server: McpServer, client: EtapiClient): void {
  server.registerTool(
    "get_note",
    {
      title: "Read a Ygdria note",
      description:
        "Read a note through ETAPI. Always call this before editing and retain the returned version for optimistic concurrency.",
      inputSchema: {
        noteId: z.string().min(1),
        format: z.enum(["markdown", "json", "html"]).optional().default("markdown"),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ noteId, format }) => {
      try {
        return success(await client.getNote(noteId, format));
      } catch (error) {
        return failure(error);
      }
    },
  );
}
