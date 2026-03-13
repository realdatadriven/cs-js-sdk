/**
 * Creates a reusable, isolated CS API client instance
 * 
 * @param {Object} [initialConfig] - Initial configuration
 * @param {string} [initialConfig.host='https://localhost'] 
 * @param {string} [initialConfig.lang='en']
 * @param {string|null} [initialConfig.token=null]
 * @param {{app_id: number, app: string}} [initialConfig.app]
 * @returns {Object} Client with chainable setters and API methods
 * 
 * @example
 * const client = createCSClient({ host: 'https://api.mycompany.com' });
 * 
 * // Chain setters
 * await client
 *   .setLang('pt')
 *   .setToken('eyJhbGciOi...')
 *   .login('joao', '123456');
 * 
 * const menu = await client.getMenu();
 */
export function createCSClient(initialConfig = {}) {
  // Private / encapsulated state
  const state = {
    host: (initialConfig.host || 'https://localhost').replace(/\/+$/, ''),
    lang: initialConfig.lang || 'en',
    token: initialConfig.token || null,
    app: initialConfig.app || { app_id: 1, app: 'ADMIN' },
  };

  // ────────────────────────────────────────────────
  //                Chainable setters
  // ────────────────────────────────────────────────

  function setHost(host) {
    if (host && typeof host === 'string') {
      state.host = host.replace(/\/+$/, '');
    }
    return client;
  }

  function setLang(lang) {
    if (lang && typeof lang === 'string') {
      state.lang = lang;
    }
    return client;
  }

  function setToken(token) {
    state.token = token || null;
    return client;
  }

  function setApp(app) {
    if (app && typeof app === 'object' && app.app_id && app.app) {
      state.app = app;
    }
    return client;
  }

  // ────────────────────────────────────────────────
  //               Core API call (private)
  // ────────────────────────────────────────────────

  async function apiCall(endpoint, payload = null, options = {}) {
    const {
      method = 'POST',
      timeoutMs = 45000,
      overrideToken,
    } = options;

    // Build clean URL
    let url;
    try {
      const base = state.host;
      const path = endpoint.replace(/^\/+/, '');
      url = new URL(path, base.endsWith('/') ? base : `${base}/`);
    } catch (err) {
      return { success: false, msg: `Invalid endpoint URL: ${err.message}` };
    }

    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    const finalToken = overrideToken ?? state.token;
    if (finalToken) {
      headers.Authorization = `Bearer ${finalToken}`;
    }

    // Auto-inject app & lang when appropriate
    let bodyPayload = payload;
    if (method !== 'GET' && payload && typeof payload === 'object' && !Array.isArray(payload)) {
      bodyPayload = { ...payload };
      if (state.app && !bodyPayload.app) bodyPayload.app = state.app;
      if (state.lang && !bodyPayload.lang) bodyPayload.lang = state.lang;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: method !== 'GET' && bodyPayload ? JSON.stringify(bodyPayload) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {}
        throw Object.assign(new Error(errorData?.msg || `HTTP ${response.status}`), {
          status: response.status,
          data: errorData,
        });
      }

      return await response.json();
    } catch (err) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError') {
        return { success: false, msg: 'Request timeout' };
      }

      return {
        success: false,
        msg: err.message || 'API call failed',
        error: err,
      };
    }
  }

  // ────────────────────────────────────────────────
  //                   Public API
  // ────────────────────────────────────────────────

  const client = {
    // Configuration
    setHost,
    setLang,
    setToken,
    setApp,

    // Low-level access (useful for custom calls)
    rawCall: apiCall,

    // Auth
    async login(username, password) {
      if (!username || !password) {
        return { success: false, msg: 'Username and password are required' };
      }
      const res = await apiCall('/dyn_api/login/login', {
        data: { username, password },
      });
      if (res?.success && res?.token) {
        state.token = res.token;
      }
      return res;
    },

    async alterPass(payload) {
      return apiCall('/dyn_api/login/alter_pass', { data: payload });
    },

    async verifyToken() {
      return apiCall('/dyn_api/login/verify_token', {});
    },

    // Admin
    async getApps() {
      const res = await apiCall('/dyn_api/admin/apps', {});
      if (res?.success && res?.data?.length > 0) {
        client.setApp(res.data[0]);
      }
      return res;
    },

    async getMenu() {
      return apiCall('/dyn_api/admin/menu', {});
    },

    async getTables(table = null) {
      return apiCall('/dyn_api/admin/tables', { table });
    },

    // CRUD
    async read(readParams) {
      return apiCall('/dyn_api/crud/read', { data: readParams });
    },

    async query(queryParams) {
      return apiCall('/dyn_api/crud/query', { data: queryParams });
    },

    async create(createParams) {
      return apiCall('/dyn_api/crud/create', { data: createParams });
    },

    async update(updateParams) {
      return apiCall('/dyn_api/crud/update', { data: updateParams });
    },

    async delete(deleteParams) {
      return apiCall('/dyn_api/crud/delete', { data: deleteParams });
    },

    async createUpdate(params) {
      return apiCall('/dyn_api/crud/create_update', { data: params });
    },

    // Upload (multipart)
    async upload({ file, path, tmp, lang } = {}) {
      if (!file) return { success: false, msg: 'File is required' };

      const formData = new FormData();
      formData.append('file', file);
      if (path) formData.append('path', path);
      if (tmp) formData.append('tmp', tmp);
      formData.append('lang', lang || state.lang);

      const url = new URL('/upload', state.host);

      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 90000);

      try {
        const res = await fetch(url, {
          method: 'POST',
          body: formData,
          headers: state.token ? { Authorization: `Bearer ${state.token}` } : {},
          signal: controller.signal,
        });

        clearTimeout(id);

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.msg || `Upload failed (${res.status})`);
        }

        return await res.json();
      } catch (err) {
        clearTimeout(id);
        return { success: false, msg: err.message };
      }
    },

    // ETLX
    async etlx(action, params = {}) {
      return apiCall(`/dyn_api/etlx/${action}`, { data: params });
    },

    // Helpers
    getUploadApi() {
      return new URL('/uploads', state.host).toString();
    },

    getConfig() {
      return { ...state, hasToken: !!state.token };
    },
  };

  return client;
}