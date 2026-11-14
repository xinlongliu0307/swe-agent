export interface Response {
  status: number;
  body: unknown;
}

type Handler = (params: Record<string, string>, body: unknown) => Response;

/** Matches "METHOD /path/:param" routes. */
export class Router {
  private routes: { method: string; parts: string[]; handler: Handler }[] = [];

  on(method: string, path: string, handler: Handler): void {
    this.routes.push({ method, parts: path.split("/").filter(Boolean), handler });
  }

  handle(method: string, path: string, body?: unknown): Response {
    const parts = path.split("/").filter(Boolean);
    for (const r of this.routes) {
      if (r.method !== method || r.parts.length !== parts.length) continue;
      const params: Record<string, string> = {};
      const ok = r.parts.every((p, i) => (p.startsWith(":") ? ((params[p.slice(1)] = parts[i]!), true) : p === parts[i]));
      if (ok) return r.handler(params, body);
    }
    return { status: 404, body: { error: "not found" } };
  }
}
