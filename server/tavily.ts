// Thin wrapper around the Tavily search API. Used to ground the agent's
// suggestions in real places (campsites, restaurants, attractions).
// If no key is set or the call fails, we return an empty result and the
// caller falls back to letting the LLM use its own knowledge.

export interface TavilyResult {
  title: string
  url: string
  content: string
}

export async function tavilySearch(query: string, maxResults = 5): Promise<TavilyResult[]> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) return []

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: maxResults,
        search_depth: 'basic',
      }),
    })
    if (!res.ok) return []
    const data = (await res.json()) as { results?: any[] }
    return (data.results ?? []).map((r) => ({
      title: String(r.title ?? ''),
      url: String(r.url ?? ''),
      content: String(r.content ?? ''),
    }))
  } catch {
    return []
  }
}

// Compact the search results into a short context string for the LLM prompt.
export function resultsToContext(results: TavilyResult[]): string {
  if (results.length === 0) return ''
  return results
    .slice(0, 5)
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.content.slice(0, 300)}`)
    .join('\n\n')
}
