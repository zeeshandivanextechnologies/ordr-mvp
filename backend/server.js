import app from './app.js';
import config from './config/environment.js';

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`ORDR Backend running on port ${PORT}`);
  console.log(`Environment: ${config.nodeEnv}`);
});
