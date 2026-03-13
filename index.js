/**
 * Modern class-based client for your dynamic API
 * Usage:
 *   const client = new CSClient({ host: 'https://your-api.com' });
 *   await client.setToken('xyz').login('user', 'pass');
 *   const menu = await client.getMenu();
 */
export class CSClient {
  #host = 'https://localhost';       // should almost always be https in production
  #lang = 'en';
  #token = null;
  #app = { app_id: 1, app: 'ADMIN' };

  /**
   * @param {Object} [config]
   * @param {string} [config.host]
   * @param {string} [config.lang]
   * @param {string} [config.token]
   * @param {{app_id: number, app: string}} [config.app]
   */
  constructor(config = {}) {
    this.#host = config.host?.replace(/\/+$/, '') || this.#host;
    this.#lang = config.lang || this.#lang;
    this.#token = config.token || null;
    this.#app = config.app || this.#app;
  }

  setHost(host) {
    this.#host = host?.replace(/\/+$/, '') || this.#host;
    return this;
  }

  setLang(lang) {
    this.#lang = lang || 'en';
    return this;
  }

  setToken(token) {
    this.#token = token || null;
    return this;
  }

  setApp(app) {
    this.#app = app && typeof app === 'object' ? app : this.#app;
    return this;
  }

  // ────────────────────────────────────────────────
  //                Core API caller
  // ────────────────────────────────────────────────

  /**
   * Low-level API call – most other methods use this
   * @param {string} endpoint    relative or absolute path
   * @param {any} [payload]
   * @param {Object} [options]
   * @param {string} [options.method='POST']
   * @param {number} [options.timeoutMs=45000]
   * @param {string} [options.overrideToken]
   * @returns {Promise<any>}
   */
  async #apiCall(endpoint, payload = null, options = {}) {
    const {
      method = 'POST',
      timeoutMs = 45000,
      overrideToken,
    } = options;

    // Normalize URL
    let url;
    try {
      url = new URL(endpoint.startsWith('http') ? endpoint : `${this.#host}/${endpoint.replace(/^\/+/, '')}`);
    } catch (err) {
      return { success: false, msg: `Invalid URL: ${err.message}` };
    }

    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    const finalToken = overrideToken ?? this.#token;
    if (finalToken) {
      headers.Authorization = `Bearer ${finalToken}`;
    }

    // Auto-inject app & lang if payload is object and fields are missing
    let bodyPayload = payload;
    if (method !== 'GET' && payload && typeof payload === 'object' && !Array.isArray(payload)) {
      bodyPayload = { ...payload };
      if (this.#app && !bodyPayload.app) {
        bodyPayload.app = this.#app;
      }
      if (this.#lang && !bodyPayload.lang) {
        bodyPayload.lang = this.#lang;
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: method !== 'GET' && bodyPayload ? JSON.stringify(bodyPayload) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        let errorData = null;
        try {
          errorData = await res.json();
        } catch {
          // fallback
        }
        throw Object.assign(new Error(errorData?.msg || `HTTP ${res.status}`), {
          status: res.status,
          data: errorData,
        });
      }

      return await res.json();
    } catch (err) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError') {
        return { success: false, msg: 'Request timeout' };
      }

      return {
        success: false,
        msg: err.message || 'Network / API error',
        error: err,
      };
    }
  }

  // ────────────────────────────────────────────────
  //                  Auth methods
  // ────────────────────────────────────────────────

  async login(username, password) {
    if (!username || !password) {
      return { success: false, msg: 'Username and password required' };
    }

    const endpoint = '/dyn_api/login/login';
    const payload = { data: { username, password } };

    const res = await this.#apiCall(endpoint, payload);

    if (res?.success && res?.token) {
      this.#token = res.token;
    }

    return res;
  }

  async alterPass(payload) {
    return this.#apiCall('/dyn_api/login/alter_pass', { data: payload });
  }

  async verifyToken() {
    return this.#apiCall('/dyn_api/login/verify_token', {});
  }

  // ────────────────────────────────────────────────
  //                  Admin / Config
  // ────────────────────────────────────────────────

  async getApps() {
    const res = await this.#apiCall('/dyn_api/admin/apps', {});
    if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
      this.setApp(res.data[0]);
    }
    return res;
  }

  async getMenu() {
    return this.#apiCall('/dyn_api/admin/menu', {});
  }

  async getTables(table = null) {
    return this.#apiCall('/dyn_api/admin/tables', { table });
  }

  // ────────────────────────────────────────────────
  //                  CRUD operations
  // ────────────────────────────────────────────────

  async read(readParams) {
    return this.#apiCall('/dyn_api/crud/read', { data: readParams });
  }

  async query(queryParams) {
    return this.#apiCall('/dyn_api/crud/query', { data: queryParams });
  }

  async create(createParams) {
    return this.#apiCall('/dyn_api/crud/create', { data: createParams });
  }

  async update(updateParams) {
    return this.#apiCall('/dyn_api/crud/update', { data: updateParams });
  }

  async delete(deleteParams) {
    return this.#apiCall('/dyn_api/crud/delete', { data: deleteParams });
  }

  async createUpdate(params) {
    return this.#apiCall('/dyn_api/crud/create_update', { data: params });
  }

  // ────────────────────────────────────────────────
  //                  File upload
  // ────────────────────────────────────────────────

  /**
   * @param {Object} payload
   * @param {File|Blob} [payload.file]
   * @param {string} [payload.path]
   * @param {string} [payload.tmp]
   * @param {string} [payload.lang]
   */
  async upload({ file, path, tmp, lang } = {}) {
    if (!file) {
      return { success: false, msg: 'File is required' };
    }

    const formData = new FormData();
    formData.append('file', file);
    if (path) formData.append('path', path);
    if (tmp) formData.append('tmp', tmp);
    formData.append('lang', lang || this.#lang);

    const url = new URL('/upload', this.#host);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // longer for uploads

    try {
      const res = await fetch(url, {
        method: 'POST',
        body: formData,
        headers: this.#token ? { Authorization: `Bearer ${this.#token}` } : {},
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.msg || `Upload failed (${res.status})`);
      }

      return await res.json();
    } catch (err) {
      clearTimeout(timeoutId);
      return { success: false, msg: err.message };
    }
  }

  // ────────────────────────────────────────────────
  //                  ETL / Misc
  // ────────────────────────────────────────────────

  async etlx(action, params = {}) {
    return this.#apiCall(`/dyn_api/etlx/${action}`, { data: params });
  }

  getUploadApi() {
    return new URL('/uploads', this.#host).toString();
  }

  // Convenience getter for current config (useful for debugging)
  getConfig() {
    return {
      host: this.#host,
      lang: this.#lang,
      hasToken: !!this.#token,
      app: this.#app,
    };
  }
}