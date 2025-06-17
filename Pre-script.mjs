/* =========  pre-script (original)  ========= */
import axios from "axios";
import crypto from "crypto";
import fs from "fs";

// Webhook.site API details for dynamic email generation
const WEBHOOK_API_BASE = "https://webhook.site";
const TOKEN_FILE_PATH = "./auth_token.txt";
let AUTH_TOKEN = "";
let WEBHOOK_TOKEN_ID = "";
const CONFIG_FILE_PATH = "./config.json"; // Added config file path

// **Generate New Webhook Email**
async function generateNewWebhookEmail() {
    try {
        console.log("🔵 Generating new Webhook email...");
        const response = await axios.post(`${WEBHOOK_API_BASE}/token`);
        WEBHOOK_TOKEN_ID = response.data.uuid;
        console.log(`✅ New Webhook Email: ${WEBHOOK_TOKEN_ID}@emailhook.site`);
    } catch (error) {
        console.error("❌ Error generating webhook email:", error.message);
        process.exit(1);
    }
}

// **Initialize Configuration**
const CONFIG = {
    BASE_URL: "https://backend-applications-819.instabug-dev.com",
    ENDPOINTS: {
        SIGNUP: "/api/web/developer",
        VERIFY_EMAIL: "/api/web/developers/verify_email",
        PERSONA: "/api/web/developer/persona",
        USE_CASE: "/api/web/developer/use_case",
        COMPANY: "/api/web/company/",
        APPLICATION: "/api/web/applications",
        APP_TOKEN: "/api/web/applications/emailhooksite/production"
    },
    CREDENTIALS: {
        email: "",
        password: "InstabuG1@@",
        name: "InstaBug"
    },
    HEADERS: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://webapp-11750.instabug-dev.com/",
        "Referer": "https://webapp-11750.instabug-dev.com/signup",
        "User-Agent": "Mozilla/5.0"
    }
};

// **Generate MD5 Verification Token**
const generateVerificationToken = () => {
    const staticValue = "731101151169798117103";
    return crypto.createHash('md5')
        .update(staticValue + CONFIG.CREDENTIALS.email + CONFIG.CREDENTIALS.name + CONFIG.CREDENTIALS.password)
        .digest('hex');
};

// **Sign-Up Function**
async function signUp() {
    console.log("🔵 Attempting sign-up...");

    const verificationToken = generateVerificationToken();
    const requestBody = {
        developer: {
            name: CONFIG.CREDENTIALS.name,
            email: CONFIG.CREDENTIALS.email,
            password: CONFIG.CREDENTIALS.password,
            verification_token: verificationToken
        }
    };

    try {
        console.log("📦 Sending Sign-Up Request...");
        const response = await axios.post(`${CONFIG.BASE_URL}${CONFIG.ENDPOINTS.SIGNUP}`, requestBody, { headers: CONFIG.HEADERS });

        console.log("✅ Sign-Up Response:", response.data);
        return response.data?.email_verified === 1;
    } catch (error) {
        console.error("❌ Sign-Up Failed:", error.response?.data || error.message);
        return false;
    }
}

// **Fetch and Extract Verification Token from Email**
async function fetchVerificationToken(retryCount = 10) {
    try {
        const url = `${WEBHOOK_API_BASE}/token/${WEBHOOK_TOKEN_ID}/requests`;
        const headers = { Accept: "application/json" };

        for (let attempt = 1; attempt <= retryCount; attempt++) {
            console.log(`📩 Fetching latest email... (Attempt ${attempt}/${retryCount})`);
            const res = await axios.get(url, { headers });
            const result = res.data;

            if (result?.data?.length > 0) {
                for (const email of result.data) {
                    console.log(`✅ Email received at ${email.created_at}`);

                    const urlMatch = email.text_content.match(/\( (https:\/\/dashdev\.instabug-dev\.com\/validate-token\?token=[a-zA-Z0-9=_-]+) \)/);
                    if (urlMatch) {
                        const verificationToken = urlMatch[1].split("=")[1]; // Extract token from URL
                        console.log(`🔗 Extracted Verification Token: ${verificationToken}`);
                        return verificationToken;
                    }
                }
                return null;
            }

            console.log("⚠️ No new emails found. Retrying in 3 seconds...");
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        console.error("❌ No email received after multiple attempts.");
        return null;
    } catch (error) {
        console.error(`❌ Error fetching email: ${error.message}`);
        return null;
    }
}

// **Verify Email and Retrieve Authentication Token**
async function verifyEmailAndRetrieveToken(verificationToken) {
    try {
        console.log("🔵 Verifying email directly...");

        if (!verificationToken) {
            console.error("❌ Error: No verification token found.");
            return null;
        }

        const response = await axios.post(
            `${CONFIG.BASE_URL}${CONFIG.ENDPOINTS.VERIFY_EMAIL}`,
            { token: verificationToken },
            { headers: CONFIG.HEADERS }
        );

        if (response.data?.developer?.token) {
            AUTH_TOKEN = response.data.developer.token;
            console.log("✅ Email verified successfully. Authentication token retrieved:", AUTH_TOKEN);
            return AUTH_TOKEN;
        } else {
            console.error("❌ Email verification failed. Response:", response.data);
            return null;
        }
    } catch (error) {
        console.error("❌ Error verifying email:", error.response?.data || error.message);
        return null;
    }
}

// **API Calls**
async function callAPIs() {
    console.log("🔵 Making API calls after verification...");
    await callPersonaAPI();
    await callUseCaseAPI();
    await callCompanyAPI();
    await callApplicationAPI();
    await fetchAppToken();
    console.log("✅ All API calls completed.");
}

// **Fetch Application Token**
async function fetchAppToken() {
    try {
        console.log("🔵 Fetching Application Token...");
        const response = await axios.get(`${CONFIG.BASE_URL}${CONFIG.ENDPOINTS.APP_TOKEN}`, {
            headers: { Authorization: `Token token="${AUTH_TOKEN}" , email="${CONFIG.CREDENTIALS.email}"` }
        });

        if (response.data && response.data.application && response.data.application.token) {
            const appToken = response.data.application.token;
            console.log("✅ Application Token Retrieved:", appToken);

            // Load existing config or create a new one if not present
            let configData = {};
            if (fs.existsSync(CONFIG_FILE_PATH)) {
                try {
                    configData = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, "utf8"));
                } catch (error) {
                    console.error("⚠️ Failed to read existing config file. A new one will be created.");
                }
            }

            // Update config with new tokens
            configData.webhook_email = CONFIG.CREDENTIALS.email;
            configData.auth_token = AUTH_TOKEN;
            configData.application_token = appToken;

            // Save updated config.json
            fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(configData, null, 2), "utf8");

            console.log("✅ Application Token Successfully Saved in config.json:", appToken);
            return appToken;
        } else {
            console.error("❌ Failed to retrieve Application Token from API response.");
            return null;
        }
    } catch (error) {
        console.error("❌ Error fetching Application Token:", error.response?.data || error.message);
        return null;
    }
}

// **Individual API Calls**
async function callPersonaAPI() {
    try {
        console.log("📡 Calling Persona API...");
        await axios.post(`${CONFIG.BASE_URL}${CONFIG.ENDPOINTS.PERSONA}`, { persona: "Dev" }, {
            headers: { Authorization: `Token token="${AUTH_TOKEN}" , email="${CONFIG.CREDENTIALS.email}"` }
        });
        console.log("✅ Persona API Call Successful");
    } catch (error) {
        console.error("❌ Persona API Call Failed:", error.message);
    }
}

async function callUseCaseAPI() {
    try {
        console.log("📡 Calling Use Case API...");
        await axios.post(`${CONFIG.BASE_URL}${CONFIG.ENDPOINTS.USE_CASE}`, { use_case: ["OTHER"] }, {
            headers: { Authorization: `Token token="${AUTH_TOKEN}" , email="${CONFIG.CREDENTIALS.email}"` }
        });
        console.log("✅ Use Case API Call Successful");
    } catch (error) {
        console.error("❌ Use Case API Call Failed:", error.message);
    }
}

async function callCompanyAPI() {
    try {
        console.log("📡 Calling Company API...");
        await axios.post(`${CONFIG.BASE_URL}${CONFIG.ENDPOINTS.COMPANY}`, { company: { name: "emailhooksite" } }, {
            headers: { Authorization: `Token token="${AUTH_TOKEN}" , email="${CONFIG.CREDENTIALS.email}"` }
        });
        console.log("✅ Company API Call Successful");
    } catch (error) {
        console.error("❌ Company API Call Failed:", error.message);
    }
}

async function callApplicationAPI() {
    try {
        console.log("📡 Calling Application API...");
        const response = await axios.post(`${CONFIG.BASE_URL}${CONFIG.ENDPOINTS.APPLICATION}`, {
            app: { name: "emailhooksite", mode: "production", target_os: [1] } //2 for android
        }, {
            headers: { Authorization: `Token token="${AUTH_TOKEN}" , email="${CONFIG.CREDENTIALS.email}"` }
        });
        console.log("✅ Application API Call Successful");
        const configData = {
            webhook_email: CONFIG.CREDENTIALS.email,
            auth_token: AUTH_TOKEN,
            application_token: response.data.application.token
        };
        fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(configData, null, 2));
    } catch (error) {
        console.error("❌ Application API Call Failed:", error.message);
    }
}

// **Run Script**
const main = async () => {
    await generateNewWebhookEmail();
    CONFIG.CREDENTIALS.email = `${WEBHOOK_TOKEN_ID}@emailhook.site`;

    console.log("🚀 Starting script execution...");
    const signUpSuccess = await signUp();

    if (signUpSuccess) {
        const verificationToken = await fetchVerificationToken();
        if (verificationToken) {
            const authToken = await verifyEmailAndRetrieveToken(verificationToken);
            if (authToken) {
                await callAPIs();
            }
        }
    }
};

/* =========  first_seen (original minus self-execute)  ========= */
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

/* =========  orchestrate: run pre-script, THEN first_seen  ========= */
await main();
await sendFirstSeen();
