# Zerodha Kite Connect - API-Based Authentication

This document explains how to set up and use the automated API-based authentication for Zerodha Kite Connect using Node.js and TypeScript.

## 🚀 Features

- **Fully Automated**: No manual browser interaction required
- **API-Based**: Uses direct API calls instead of browser automation
- **TOTP Support**: Automatic 2FA using TOTP (Time-based One-Time Password)
- **Session Management**: Automatic session persistence and validation
- **Error Handling**: Comprehensive error handling with detailed messages
- **TypeScript**: Full TypeScript support with proper type definitions

## 📋 Prerequisites

1. **Zerodha Kite Connect API Access**

   - API Key
   - API Secret
   - Redirect URI (set in your Kite Connect app)

2. **TOTP Secret Key**
   - Base32 TOTP secret from your 2FA setup

## 🛠️ Setup Instructions

### Step 1: Install Dependencies

The required packages are already installed in the project:

- `axios` - HTTP client
- `qs` - Query string parser
- `otplib` - TOTP generation
- `dotenv` - Environment variable management

### Step 2: Get Your TOTP Secret

1. Login to [Zerodha Kite](https://kite.zerodha.com)
2. Go to **Settings** → **API**
3. When setting up 2FA, you'll see a QR code
4. Use an authenticator app to scan it
5. The secret key shown (base32 format) is your `TOTP_SECRET`

### Step 3: Configure Environment Variables

Create a `.env` file in your project root:

```env
# Zerodha API Configuration
ZERODHA_API_KEY=your_api_key_here
ZERODHA_API_SECRET=your_api_secret_here
ZERODHA_USER_ID=your_kite_user_id
ZERODHA_PASSWORD=your_kite_password
ZERODHA_TOTP_SECRET=your_base32_totp_secret
ZERODHA_REDIRECT_URI=https://127.0.0.1
```

## 🔧 Usage

### Method 1: Standalone Example

Run the standalone automated login example:

```bash
npm run dev -- src/auth/automated-login-example.ts
```

This will:

1. Automatically log in to Zerodha Kite
2. Extract the access token
3. Test the token with a sample API call
4. Display session details

### Method 2: Using the ZerodhaApiAuth Class

```typescript
import {
  ZerodhaApiAuth,
  ZerodhaApiAuthConfig,
} from "./src/auth/zerodha-api-auth";

const config: ZerodhaApiAuthConfig = {
  apiKey: process.env.ZERODHA_API_KEY!,
  apiSecret: process.env.ZERODHA_API_SECRET!,
  userId: process.env.ZERODHA_USER_ID!,
  password: process.env.ZERODHA_PASSWORD!,
  totpSecret: process.env.ZERODHA_TOTP_SECRET!,
  redirectUri: process.env.ZERODHA_REDIRECT_URI || "https://127.0.0.1",
};

const auth = new ZerodhaApiAuth(config);

// Initialize authentication
await auth.initialize();

// Get the session
const session = auth.getSession();
if (session) {
  console.log("Access Token:", session.accessToken);

  // Make API calls
  const profile = await auth.makeAuthenticatedRequest("/user/profile");
  console.log("User Profile:", profile.data);
}
```

### Method 3: Comprehensive Test

Run the comprehensive test suite:

```bash
npm run dev -- src/auth/test-zerodha-api-auth.ts
```

This test will:

- Validate all environment variables
- Perform automated login
- Test multiple API endpoints
- Display detailed session information

## 📊 API Endpoints You Can Use

Once authenticated, you can make calls to any Kite Connect API endpoint:

```typescript
// Get user profile
const profile = await auth.makeAuthenticatedRequest("/user/profile");

// Get account margins
const margins = await auth.makeAuthenticatedRequest("/user/margins");

// Get portfolio holdings
const holdings = await auth.makeAuthenticatedRequest("/portfolio/holdings");

// Get positions
const positions = await auth.makeAuthenticatedRequest("/portfolio/positions");

// Get instruments
const instruments = await auth.makeAuthenticatedRequest("/instruments");

// Place an order
const order = await auth.makeAuthenticatedRequest("/orders/regular", "POST", {
  exchange: "NSE",
  tradingsymbol: "RELIANCE",
  transaction_type: "BUY",
  quantity: 1,
  order_type: "MARKET",
  product: "CNC",
});
```

## 🔐 Security Best Practices

1. **Environment Variables**: Never hardcode credentials in your source code
2. **File Permissions**: Ensure your `.env` file has restricted permissions
3. **Token Storage**: Session tokens are stored securely in the `data/` directory
4. **Session Expiry**: Tokens automatically expire and are refreshed as needed

## 🐛 Troubleshooting

### Common Issues

1. **Invalid TOTP**

   - Ensure your system time is accurate
   - Check that the TOTP secret is correct (base32 format)

2. **Authentication Failed**

   - Verify your User ID and Password
   - Check if your account has 2FA enabled

3. **Rate Limits**

   - Zerodha has rate limits on API calls
   - Wait and retry if you hit rate limits

4. **Network Issues**
   - Check your internet connection
   - Ensure you can access zerodha.com

### Debug Mode

Enable debug logging by setting the log level:

```typescript
// In your code
logger.level = "debug";
```

## 📁 File Structure

```
src/auth/
├── zerodha-api-auth.ts          # Main authentication class
├── automated-login-example.ts   # Standalone example
├── test-zerodha-api-auth.ts    # Comprehensive test suite
├── zerodha-auth.ts             # Legacy browser-based auth
├── generate-login-url.ts       # URL generation utility
└── test-zerodha-auth.ts        # Legacy test file
```

## 🔄 Session Management

- Sessions are automatically saved to `data/zerodha-api-session.json`
- Sessions are validated on each initialization
- Expired sessions trigger automatic re-authentication
- Sessions expire at 6 AM IST (Zerodha's policy)

## 📈 Performance

- **Fast**: No browser automation overhead
- **Reliable**: Direct API calls with proper error handling
- **Efficient**: Session reuse reduces authentication calls

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Disclaimer

This is for educational and development purposes. Always follow Zerodha's terms of service and API usage guidelines. Use at your own risk in production environments.
