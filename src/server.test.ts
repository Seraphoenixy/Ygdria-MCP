import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "./index.js";

async function inspectServer(allowWrite: boolean): Promise<{
  tools: string[];
  resourceTemplates: string[];
}> {
  const server = createServer({
    baseUrl: "http://127.0.0.1:4318",
    token: "test-token",
    allowWrite,
  });
  const client = new Client({ name: "ygdria-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const [tools, templates] = await Promise.all([
      client.listTools(),
      client.listResourceTemplates(),
    ]);
    return {
      tools: tools.tools.map((tool) => tool.name).sort(),
      resourceTemplates: templates.resourceTemplates.map(
        (template) => template.uriTemplate,
      ),
    };
  } finally {
    await client.close();
    await server.close();
  }
}

test("read-only MCP mode does not advertise write tools", async () => {
  const result = await inspectServer(false);
  assert.deepEqual(result.tools, [
    "get_note",
    "get_tree_node",
    "get_tree_subtree",
    "list_tags",
    "list_tree_children",
    "list_tree_roots",
    "resolve_tree_nodes",
    "search_by_tag",
    "search_notes",
  ]);
  assert.deepEqual(result.resourceTemplates, ["ygdria://note/{noteId}"]);
});

test("write tools require explicit server authorization", async () => {
  const result = await inspectServer(true);
  assert.deepEqual(result.tools, [
    "create_note",
    "edit_content",
    "get_note",
    "get_tree_node",
    "get_tree_subtree",
    "list_tags",
    "list_tree_children",
    "list_tree_roots",
    "move_placement",
    "replace_content",
    "resolve_tree_nodes",
    "search_by_tag",
    "search_notes",
    "update_note",
  ]);
});
