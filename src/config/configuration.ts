import appConfig from './app.config';
import authConfig from './auth.config';
import databaseConfig from './database.config';
import mailConfig from './mail.config';

export default () => ({
  app: appConfig(),
  auth: authConfig(),
  database: databaseConfig(),
  mail: mailConfig(),
});
