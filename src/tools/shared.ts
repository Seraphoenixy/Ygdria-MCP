import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { EtapiError, EtapiNetworkError } from "../client/etapi-client.js";

export function success(data: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

export function failure(error: unknown): CallToolResult {
  const message =
    error instanceof EtapiError || error instanceof EtapiNetworkError
      ? error.message
      : error instanceof Error
        ? error.message
        : "Unexpected error while communicating with Ygdria ETAPI.";
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}

export async function versionConflict(
  client: { getNote(noteId: string, format: "markdown"): Promise<unknown> },
  noteId: string,
): Promise<CallToolResult> {
  try {
    const latest = await client.getNote(noteId, "markdown");
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: "version_conflict",
              message:
                "The note changed. Re-evaluate the requested edit against this latest state; do not retry the old version.",
              latest,
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    return failure(error);
  }
}
