import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { EtapiClient } from "../client/etapi-client.js";
import { failure, success } from "./shared.js";

export function registerUploadImage(server: McpServer, client: EtapiClient): void {
  server.registerTool("upload_image", {
    title: "Upload a Ygdria image",
    description: "Upload Base64 image bytes to an existing unprotected note. Returns a stored attachment URL and Markdown. Insert that Markdown using a versioned content edit; uploading alone does not insert the image. Identical bytes are deduplicated. Never embed data: URLs in note content.",
    inputSchema: {
      noteId: z.string().min(1),
      filename: z.string().min(1).max(255).regex(/^[^/\\\x00-\x1f]+$/),
      dataBase64: z.string().min(4).max(4 * Math.ceil(20 * 1024 * 1024 / 3)),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (input) => {
    try { return success(await client.uploadImage(input)); }
    catch (error) { return failure(error); }
  });
}
