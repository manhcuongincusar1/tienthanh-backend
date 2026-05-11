const {Pool} = require('pg');
const BaseConnection = require("./baseConnection");
const config = require('../config/setting')();
class PostgresqlConnect extends BaseConnection {
    dbConnection;
    constructor() {
        super();
        const connectionString = config.databases.postgres;
        this.dbConnection = new Pool({
            connectionString,
        })
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