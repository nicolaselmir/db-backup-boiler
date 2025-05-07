const getDbEnvVars = (prefix) => {
  const enabled = process.env[`${prefix}_ENABLED`] === 'true';
  
  if (!enabled) return null;
  
  return {
    enabled,
    type: process.env[`${prefix}_TYPE`],
    name: process.env[`${prefix}_NAME`],
    connectionString: process.env[`${prefix}_CONNECTION_STRING`],
    useSSL: process.env[`${prefix}_USE_SSL`] === 'true',
    sslCertPath: process.env[`${prefix}_SSL_CERT_PATH`] || null,
  };
};

export const loadDatabaseConfigs = () => {
  const databases = [];
  
  const pgConfig = getDbEnvVars('DB_PG');
  if (pgConfig) databases.push(pgConfig);
  
  const mongoConfig = getDbEnvVars('DB_MONGO');
  if (mongoConfig) databases.push(mongoConfig);
  
  const mysqlConfig = getDbEnvVars('DB_MYSQL');
  if (mysqlConfig) databases.push(mysqlConfig);
  
  return databases;
};

export const addDatabaseConfig = (config) => {
  return config;
};

export const getDatabases = () => {
  return loadDatabaseConfigs();
};

export default { loadDatabaseConfigs, addDatabaseConfig, getDatabases };