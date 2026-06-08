export async function parseApiResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();

  if (!contentType.includes('application/json')) {
    const looksLikeHtml = text.trimStart().startsWith('<!DOCTYPE') || text.trimStart().startsWith('<html');
    const hint = looksLikeHtml
      ? 'API 请求返回了页面 HTML，通常是 ESA Functions 没有接管 /api 路由。请检查函数文件路径是否配置为 functions/index.ts。'
      : text.slice(0, 200);
    throw new Error(hint);
  }

  try {
    const data = JSON.parse(text) as T;
    if (!res.ok) {
      const message = data && typeof data === 'object' && 'message' in data
        ? String((data as { message?: unknown }).message)
        : `API error: ${res.status}`;
      throw new Error(message);
    }
    return data;
  } catch (e) {
    if (e instanceof Error) throw e;
    throw new Error('API 返回的 JSON 无法解析');
  }
}
