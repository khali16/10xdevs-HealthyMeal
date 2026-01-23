import { z } from 'zod'

import type {
  ChatMessage,
  CreateChatCompletionInput,
  ModelParams,
  OpenRouterResponseFormat,
  OpenRouterResponseFormatJsonSchema,
} from './types'

export const OPENROUTER_LIMITS = {
  maxMessageChars: 20_000,
  maxHistoryMessages: 50,
  maxModelNameChars: 200,
  maxSchemaNameChars: 100,
  maxMaxTokens: 8_192,
} as const

const chatRoleSchema = z.enum(['system', 'user', 'assistant'])

export const chatMessageSchema = z.object({
  role: chatRoleSchema,
  content: z.string().trim().min(1).max(OPENROUTER_LIMITS.maxMessageChars),
}) satisfies z.ZodType<ChatMessage>

export const modelParamsSchema = z
  .object({
    temperature: z.number().finite().min(0).max(2).optional(),
    max_tokens: z
      .number()
      .int()
      .positive()
      .max(OPENROUTER_LIMITS.maxMaxTokens)
      .optional(),
    top_p: z.number().finite().min(0).max(1).optional(),
    frequency_penalty: z.number().finite().min(-2).max(2).optional(),
    presence_penalty: z.number().finite().min(-2).max(2).optional(),
    seed: z.number().int().optional(),
    stop: z.union([z.string().trim().min(1).max(200), z.array(z.string().trim().min(1).max(200)).max(10)]).optional(),
  })
  .strict() satisfies z.ZodType<ModelParams>

export const responseFormatJsonSchemaSchema = z
  .object({
    type: z.literal('json_schema'),
    json_schema: z
      .object({
        name: z.string().trim().min(1).max(OPENROUTER_LIMITS.maxSchemaNameChars),
        strict: z.literal(true),
        schema: z.record(z.unknown()),
      })
      .strict(),
  })
  .strict() satisfies z.ZodType<OpenRouterResponseFormatJsonSchema>

export const responseFormatSchema = responseFormatJsonSchemaSchema satisfies z.ZodType<OpenRouterResponseFormat>

export const createChatCompletionInputSchema = z
  .object({
    systemMessage: z.string().trim().min(1).max(OPENROUTER_LIMITS.maxMessageChars).optional(),
    history: z.array(chatMessageSchema).max(OPENROUTER_LIMITS.maxHistoryMessages).optional(),
    userMessage: z.string().trim().min(1).max(OPENROUTER_LIMITS.maxMessageChars),
    model: z.string().trim().min(1).max(OPENROUTER_LIMITS.maxModelNameChars).optional(),
    params: modelParamsSchema.optional(),
    response_format: responseFormatSchema.optional(),
  })
  .strict() satisfies z.ZodType<CreateChatCompletionInput>

export function parseCreateChatCompletionInput(input: unknown): CreateChatCompletionInput {
  return createChatCompletionInputSchema.parse(input)
}

export function parseResponseFormatJsonSchema(input: unknown): OpenRouterResponseFormatJsonSchema {
  return responseFormatJsonSchemaSchema.parse(input)
}

export function validateStructuredOutput<T>(value: unknown, schema: z.ZodType<T>): T {
  return schema.parse(value)
}

