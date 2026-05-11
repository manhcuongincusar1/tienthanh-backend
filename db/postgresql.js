const {Pool} = require('pg');
const BaseConnection = require("./baseConnection");
const config = require('../config/setting')();

// bigint (OID 20) — coerce sang Number để callsite không phải tự coerce.
// PG default trả string vì JS Number không cover > 2^53. App tita không có bigint
// vượt safe-int, nên coerce global an toàn.
require('pg').types.setTypeParser(20, (val) => (val === null ? null : Number(val)));

class PostgresqlConnect extends BaseConnection {
    dbConnection;
    constructor() {
        super();
        const connectionString = config.databases.postgres;
        this.dbConnection = new Pool({
            connectionString,
            max: Number(process.env.PG_POOL_MAX) || 20,
            min: Number(process.env.PG_POOL_MIN) || 4,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
            statement_timeout: 30000,
            query_timeout: 30000,
            application_name: 'tita-api-pg',
        });

        this.dbConnection.on('error', (err) => {
            console.error('pg_pool_error', err);
        });

        // Pool stats log mỗi 30s — debug pool exhaustion (DECISIONS B5).
        if (process.env.NODE_ENV !== 'test') {
            setInterval(() => {
                const {totalCount, idleCount, waitingCount} = this.dbConnection;
                if (waitingCount > 0) {
                    console.warn('pg_pool_waiting', {totalCount, idleCount, waitingCount});
                } else {
                    console.log('pg_pool_stats', {totalCount, idleCount, waitingCount});
                }
            }, 30000).unref();
        }
    }


    getDb = async () => {
        return await this.dbConnection.connect();
    }

    query = async (text, params) => {
        const client = await this.getClient();
        const start = performance.now();
        const res = await client.query(text, params);
        const duration = performance.now() - start
        console.info(`executed query: ${duration}`);
        client.release();
        return res;
    }

    getClient = async () => {
        const client = await this.getDb();
        const query = client.query

        const release = client.release
        // monkey patch the query method to keep track of the last query executed
        client.query = (...args) => {
            client.lastQuery = args
            return query.apply(client, args)
        }
        // set a timeout of 5 seconds, after which we will log this client's last query
        const timeout = setTimeout(() => {
            console.info(`The last executed query on this client was: ${client.lastQuery}`)
        }, 5000)

        client.release = (err) => {
            // clear our timeout
            clearTimeout(timeout)
            // set the methods back to their old un-monkey-patched version
            client.query = query
            client.release = release
            return release.apply(client)
        }
        return client
    }
}

module.exports = new PostgresqlConnect();