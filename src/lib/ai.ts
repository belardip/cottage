import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function generateJson(prompt: string): Promise<unknown> {
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  })
  if (msg.stop_reason === 'max_tokens') {
    throw new Error('AI response was too long and got cut off. Try reducing the number of ingredients.')
  }
  const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
  const cleaned = text
    .replace(/^```(?:json)?\s*\n?/m, '')
    .replace(/\n?```\s*$/m, '')
    .trim()
  return JSON.parse(cleaned)
}
