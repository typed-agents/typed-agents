import zodToJsonSchema from "zod-to-json-schema";
import { ZodType } from "zod";
import type { ToolParameterSchema } from "../../tools/tool.types";

/**
 * Converts a Zod schema to a JSON Schema compatible with LLM tool definitions.
 *
 * Uses zod-to-json-schema to transform the Zod type into a JSON Schema object,
 * stripping metadata like $schema and definitions for cleaner tool parameters.
 *
 * @param zodSchema - The Zod schema to convert.
 * @returns A ToolParameterSchema object for LLM tool parameters.
 */
export const convertZodToToolSchema = (
  zodSchema: ZodType
): ToolParameterSchema => {
  const jsonSchema = zodToJsonSchema(
    zodSchema as unknown as Parameters<typeof zodToJsonSchema>[0]
  ) as Record<string, unknown>;

  const { $schema, definitions, ...rest } = jsonSchema;

  return {
    type: "object",
    ...(rest as Omit<ToolParameterSchema, "type">),
  };
};