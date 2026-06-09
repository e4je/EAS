export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has('accept')) {
    headers.set('accept', 'application/json');
  }
  if (!headers.has('x-requested-with')) {
    headers.set('x-requested-with', 'fetch');
  }

  return fetch(input, {
    ...init,
    cache: init.cache || 'no-store',
    headers,
  });
}

export async function parseApiResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();

  if (!contentType.includes('application/json')) {
    const looksLikeHtml = text.trimStart().startsWith('<!DOCTYPE') || text.trimStart().startsWith('<html');
    const hint = looksLikeHtml
      ? 'API 请求返回了页面 HTML，通常是 /api 请求被静态页面 fallback 或边缘缓存接管了。请检查 ESA Functions 的函数文件路径为 functions/index.ts，并确认 /api/* 路由优先于静态资源。'
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
