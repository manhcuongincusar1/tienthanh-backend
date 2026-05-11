const MongoClient = require('mongodb').MongoClient;
const BaseConnection = require('./baseConnection');
const config = require('../config/setting')();

class MongodbConnect extends BaseConnection {
  dbConnection;
  clientConnection;

  constructor() {
    super();
    const connectionString = config.databases.mongoDB;
    this.connectToServer(connectionString);
  }

  connectToServer = (url) => {
    this.dbConnection = MongoClient.connect(url)
      .then((client) => {
        console.info('Successfully connected to MongoDB.');
        this.clientConnection = client;
        return client.db();
      })
      .catch((error) => {
        console.log(error);
        console.info('Failed connected to MongoDB.');
      });
  };

  getDb = () => {
    return this.dbConnection;
  };
}

module.exports = new MongodbConnect();
