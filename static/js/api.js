const DEFAULTS = { headers: { "Content-Type": "application/json" } };

function tgHeaders() {
  const init = window.Telegram?.WebApp?.initData;
  return init ? { "X-Telegram-Init-Data": init } : {};
}

async function request(path, options = {}) {
  const res = await fetch(path, {
    ...DEFAULTS,
    ...options,
    headers: { ...DEFAULTS.headers, ...tgHeaders(), ...(options.headers || {}) },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  if (!res.ok) {
    const detail = data && data.detail ? data.detail : res.statusText;
    const err = new Error(typeof detail === "string" ? detail : "Ошибка запроса");
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body: body ?? {} }),
  put: (path, body) => request(path, { method: "PUT", body: body ?? {} }),
  patch: (path, body) => request(path, { method: "PATCH", body: body ?? {} }),
  del: (path) => request(path, { method: "DELETE" }),
};
