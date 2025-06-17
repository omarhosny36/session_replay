import axios from 'axios';
import { readFile } from 'fs/promises';

const CONFIG_PATH = './config.json';
const SDK_VERSION = '14.2.0';   
const APP_VERSION = '1.0 (5)';  
const TIMEOUT_MS  = 5_000;      

async function sendFirstSeen() {
  const { application_token } = JSON.parse(await readFile(CONFIG_PATH, 'utf8'));

  const headers = {
    'ibg-sdk-version': SDK_VERSION,
    'ibg-os'        : 'ios',
    'content-type'  : 'application/json',
    'ibg-app-token' : application_token,
    'app-version'   : APP_VERSION,
    'user-agent'    : `InstabugDemo/${APP_VERSION} node-script`
  };

  const url =
    `https://backend-applications-819.instabug-dev.com/api/sdk/v3/first_seen` +
    `?application_token=${application_token}`;

  try {
    const { status } = await axios.get(url, { headers, timeout: TIMEOUT_MS });
    console.log(`✅ first_seen sent (status ${status}) • SDK ${SDK_VERSION}`);
  } catch (err) {
    console.error('❌ first_seen failed:',
      err.response?.data ?? err.message);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await sendFirstSeen();       
}

export { sendFirstSeen };
