import type { RecipeDraftVM, RecipeFieldConfidenceVM, RecipeIngredientDraftVM, RecipeStepDraftVM } from './types'

type ParseResult = {
  draftPatch: Partial<RecipeDraftVM>
  confidences: RecipeFieldConfidenceVM
  warnings: string[]
}

const INGREDIENTS_HEADERS = ['skladniki', 'składniki', 'ingredients']
const STEPS_HEADERS = ['kroki', 'przygotowanie', 'instrukcja', 'steps', 'instructions']

const normalizeHeader = (line: string) => line.trim().toLowerCase()

const isHeaderMatch = (line: string, candidates: string[]) => {
  const normalized = normalizeHeader(line).replace(/:$/, '')
  return candidates.some((candidate) => normalized === candidate)
}

const parseAmount = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (trimmed.includes('/')) {
    const [left, right] = trimmed.split('/')
    const leftNum = Number(left)
    const rightNum = Number(right)
    if (Number.isFinite(leftNum) && Number.isFinite(rightNum) && rightNum !== 0) {
      return leftNum / rightNum
    }
  }
  const num = Number(trimmed.replace(',', '.'))
  return Number.isFinite(num) ? num : undefined
}

const UNIT_MAP: Record<string, { unit: string; factor: number }> = {
  g: { unit: 'g', factor: 1 },
  gram: { unit: 'g', factor: 1 },
  grams: { unit: 'g', factor: 1 },
  kg: { unit: 'g', factor: 1000 },
  dag: { unit: 'g', factor: 10 },
  mg: { unit: 'g', factor: 0.001 },
  ml: { unit: 'ml', factor: 1 },
  l: { unit: 'ml', factor: 1000 },
  litr: { unit: 'ml', factor: 1000 },
  litry: { unit: 'ml', factor: 1000 },
  szt: { unit: 'szt', factor: 1 },
  sztuk: { unit: 'szt', factor: 1 },
  pcs: { unit: 'szt', factor: 1 },
}

const normalizeIngredientLine = (line: string): RecipeIngredientDraftVM => {
  const trimmed = line.trim()
  const match = trimmed.match(/^([\d.,/]+)\s+([a-zA-Ząćęłńóśżź]+)\b\s*(.*)$/i)
  if (!match) {
    return { id: crypto.randomUUID(), text: trimmed, confidence: 0.6 }
  }

  const amountRaw = parseAmount(match[1] ?? '')
  const unitKey = (match[2] ?? '').toLowerCase()
  const unitInfo = UNIT_MAP[unitKey]
  if (!amountRaw || !unitInfo) {
    return { id: crypto.randomUUID(), text: trimmed, confidence: 0.6 }
  }

  const normalizedAmount = Math.round(amountRaw * unitInfo.factor * 100) / 100
  const rest = match[3]?.trim()
  const text = rest ? `${normalizedAmount} ${unitInfo.unit} ${rest}` : trimmed

  return {
    id: crypto.randomUUID(),
    text,
    amount: normalizedAmount,
    unit: unitInfo.unit,
    confidence: 0.92,
  }
}

const normalizeStepLine = (line: string): RecipeStepDraftVM => {
  const trimmed = line.trim()
  const hasNumber = /^\d+[\).\s-]+/.test(trimmed)
  const cleaned = trimmed.replace(/^\d+[\).\s-]+/, '').trim()
  return { id: crypto.randomUUID(), text: cleaned || trimmed, confidence: hasNumber ? 0.9 : 0.7 }
}

export const parseRawRecipeToDraft = (raw: string): ParseResult => {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const warnings: string[] = []
  let title = ''
  let ingredients: RecipeIngredientDraftVM[] = []
  let steps: RecipeStepDraftVM[] = []
  let currentSection: 'ingredients' | 'steps' | 'none' = 'none'

  lines.forEach((line) => {
    if (isHeaderMatch(line, INGREDIENTS_HEADERS)) {
      currentSection = 'ingredients'
      return
    }
    if (isHeaderMatch(line, STEPS_HEADERS)) {
      currentSection = 'steps'
      return
    }

    if (currentSection === 'ingredients') {
      ingredients.push(normalizeIngredientLine(line))
      return
    }
    if (currentSection === 'steps') {
      steps.push(normalizeStepLine(line))
      return
    }
  })

  if (!ingredients.length || !steps.length) {
    const fallbackTitle = lines[0] ?? ''
    title = fallbackTitle
    if (!ingredients.length && lines.length > 1) {
      ingredients = lines.slice(1, Math.min(6, lines.length)).map(normalizeIngredientLine)
    }
    if (!steps.length && lines.length > 2) {
      steps = lines.slice(Math.min(6, lines.length)).map(normalizeStepLine)
    }
  } else {
    title = lines[0] ?? ''
  }

  if (!ingredients.length) warnings.push('Nie wykryto listy składników.')
  if (!steps.length) warnings.push('Nie wykryto listy kroków.')

  const titleConfidence = title ? 0.95 : 0.4
  const ingredientsConfidence = ingredients.length >= 2 ? 0.9 : ingredients.length ? 0.65 : 0.3
  const stepsConfidence = steps.length >= 2 ? 0.9 : steps.length ? 0.65 : 0.3

  const draftPatch: Partial<RecipeDraftVM> = {
    raw,
    title: {
      value: title,
      confidence: title ? titleConfidence : 0.4,
      source: title ? 'parsed' : 'manual',
    },
    ingredients: ingredients.map((item) => ({ value: item, source: 'parsed' })),
    steps: steps.map((item) => ({ value: item, source: 'parsed' })),
    warnings,
  }

  return {
    draftPatch,
    confidences: {
      title: titleConfidence,
      ingredients: ingredientsConfidence,
      steps: stepsConfidence,
    },
    warnings,
  }
}
