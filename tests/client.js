import assert from 'node:assert/strict';
export class Client {
  constructor(base) { this.base = base; this.cookies = new Map(); this.csrf = ''; }
  async call(path, method = 'GET', body, expected = 200, extra = {}) {
    const response = await fetch(this.base + path, { method, redirect: 'manual', headers: {
      cookie: [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; '),
      'content-type': 'application/json', 'x-csrf-token': this.csrf, ...extra,
    }, ...(body ? { body: JSON.stringify(body) } : {}) });
    for (const cookie of response.headers.getSetCookie()) { const [key, ...parts] = cookie.split(';')[0].split('='); this.cookies.set(key, parts.join('=')); }
    const text = await response.text();
    if (text.includes('name="csrf-token"')) this.csrf = text.match(/name="csrf-token" content="([^"]+)"/)?.[1] || '';
    let data; try { data = JSON.parse(text); } catch { data = text; }
    assert.equal(response.status, expected, `${method} ${path}: ${typeof data === 'string' ? data.slice(0, 200) : JSON.stringify(data)}`);
    return data;
  }
}
