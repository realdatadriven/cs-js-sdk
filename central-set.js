export const CS = {
    host: 'localhost',
    lang: 'en',
    token: null,
    app: {app_id: 1, app: 'ADMIN'},
    set_host: function (host = 'localhost') {
        // console.log(this);
        this.host = host;
        return this;
    },
    set_lang: function (lang = 'en') {
        this.lang = lang;
        return this;
    },
    set_token: function (token = 'en') {
        this.token = token;
        return this;
    },
    set_app: function (app) {
        this.app = app || {app_id: 1, app: 'ADMIN'};
        return this;
    },
    api_call: async function (api, payload) {
        try {
            const headers = {
                'Accept': '*/*',
                'Content-type': 'application/json',
            };            
            if (payload?.token || this.token) {
                headers['Authorization'] = `Bearer ${payload?.token || this.token}`;
            }
            if (this.app && typeof payload === 'object' && !payload?.app) {
                payload.app = this.app;
            }
            if (this.lang && typeof payload === 'object' && !payload?.lang) {
                payload.lang = this.lang;
            }
            // console.log(1, {api});
            // api = api.replace(/\/\//g, "/");
            api = api.replace(/\/\/(?!.*\/\/)/, '/');
            // api = api.replace(/(\/\/)+/g, '/');
            //console.log(2, {api});
            const response = await fetch(api, {
                method: 'POST',
                // credentials: 'include',
                body: JSON.stringify(payload),
                headers: headers,
                verify: false,
                timeout: 10000,
            });
            return await response.json();
        } catch (error) {
            return {
                success: false,
                msg: `API Call Err: ${error.message}`,
            };
        }
    },
    login: async function (user = null, password = null) {
        const api = `${this.host}/dyn_api/login/login`;
        const payload = { data: { username: user, password } };
        const res = await this.api_call(api, payload);
        if (res.success) {
            this.token = res.token;
        }
        return res;
    },
    alter_pass: async function (payload) {
        const api = `${this.host}/dyn_api/login/alter_pass`;
        const res = await this.api_call(api, { data: payload });
        return res;
    },
    verify_token: async function () {
        const api = `${this.host}/dyn_api/login/verify_token`;
        const res = await this.api_call(api, {});
        return res;
    },
    get_apps: async function () {
        const api = `${this.host}/dyn_api/admin/apps`;
        const res = await this.api_call(api, {});
        if (res?.success) {
            this.set_app(res?.data?.[0]);
        }
        return res;
    },
    get_menu: async function () {
        const api = `${this.host}/dyn_api/admin/menu`;
        return await this.api_call(api, {});
    },
    get_tables: async function (table = null) {
        const api = `${this.host}/dyn_api/admin/tables`;
        return await this.api_call(api, { table });
    },
    read_params: {
        table: null, // table name
        tables: null, // list / array of table
        database: null, // database name or sqlalchemy style conn object
        limit: 10, // Number of rows to retrieve
        offset: 0, // Where to start 
        fields: null, // list / array of fields to retrieve ['column1', 'column2']
        filters: null, // list / array of filters to apply [{field: 'field_name', cond: '=|>|<|>=', value: 'value'}]
        order_by: null, // list / array of order to apply [{field: 'field_name', order: 'DESC|ASC'}]
        pattern: null, // string with search pattern
        distinct: false, // retrive without duplication
        join: null, // string dictating the need to join with FK in the table none|all 
        apply_patt_only: null // list of tables to apply the pattern to, in case you want to ignore some
    },
    read: async function (read_params) {
        const api = `${this.host}/dyn_api/crud/read`;
        return await this.api_call(api, { data: read_params });
    },
    query_params: {
        use_query_string: true,
        query: null,
        database: null, // database name or sqlalchemy style conn object
    },
    query: async function (query_params) {
        const api = `${this.host}/dyn_api/crud/query`;
        return await this.api_call(api, { data: query_params });
    },
    create_params: {
        table: null, // table name
        database: null, // database name or sqlalchemy style conn object
        data: {} // data object or array of data object
    },
    create: async function (create_params) {
        const api = `${this.host}/dyn_api/crud/create`;
        return await this.api_call(api, { data: create_params });
    },
    update: async function (create_params) {
        const api = `${this.host}/dyn_api/crud/update`;
        return await this.api_call(api, { data: create_params });
    },
    delete: async function (create_params) {
        const api = `${this.host}/dyn_api/crud/delete`;
        return await this.api_call(api, { data: create_params });
    },
    create_update: async function (create_params) {
        const api = `${this.host}/dyn_api/crud/create_update`;
        return await this.api_call(api, { data: create_params });
    },
    upload: async function (payload, files = null) {
        const api = `${this.host}/upload`;
        const headers = {
            Accept: '*/*',
            enctype: 'multipart/form-data',
            Authorization: `Bearer ${this.token}`,
        };
        const formData = new FormData();
        formData.append('lang', payload?.lang || payload?.conf?.lang || this.lang);  
        formData.append('file', payload.file || files); // REQUIRED
        formData.append('tmp', payload.tmp);
        formData.append('path', payload.path);
        const res = await fetch(api, {
            method: 'POST',
            body: formData,
            headers: headers,
            timeout: 1000,
        });
        return await res.json();
    },
    parse_icals: async function (params) {
        const api = `${this.host}/dyn_api/crud/parse_icals`;
        return await this.api_call(api, { data: params });
    },
    mail_smtp: async function (params) {
        const api = `${this.host}/dyn_api/mail/smtp`;
        return await this.api_call(api, { data: params });
    },
    mail_outlook: async function (params) {
        const api = `${this.host}/dyn_api/mail/outlook`;
        return await this.api_call(api, { data: params });
    },
    invite_outlook: async function (params) {
        const api = `${this.host}/dyn_api/mail/outlook_invite`;
        return await this.api_call(api, { data: params });
    },
    etl: async function (action, params) {
        const api = `${this.host}/dyn_api/etl/${action}`;
        return await this.api_call(api, { data: params });
    },
    get_upload_api: function (payload) {
        let api = `${this.host}/uploads`;
        api = api.replace(/\/\/(?!.*\/\/)/, '/');
        return api;
    }

}