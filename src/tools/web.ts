interface WebResult {
  status: number
  statusText: string
  headers: Record<string, string>
  data: any
}

export class WebTool {
  async execute(params: { url: string, method?: 'GET' | 'POST' | 'PUT' | 'DELETE', data?: any }): Promise<WebResult> {
    const { url, method = 'GET', data } = params
    
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        'User-Agent': 'Minibot/1.0.0'
        },
        body: data ? JSON.stringify(data) : undefined,
      })

      const result = await response.json()
      
      return {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data: result
      }
    } catch (error) {
      return {
        status: 0,
        statusText: error instanceof Error ? error.message : 'Unknown error',
        headers: {},
        data: null
      }
    }
  }
}

export default new WebTool()
