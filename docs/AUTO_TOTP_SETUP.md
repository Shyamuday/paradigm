# 🔐 Zerodha Automatic TOTP Authentication Setup Guide

This guide will help you set up the **fully automatic TOTP-based authentication** for Zerodha trading. No manual input required - everything is handled automatically!

## ✨ Features

- **🚀 Fully Automatic**: Zero manual intervention required
- **🔒 TOTP-Based**: Uses Time-based One-Time Passwords for secure authentication
- **💾 Session Management**: Automatically saves and reuses sessions
- **🔄 Auto-Retry**: Automatically re-authenticates when sessions expire
- **⚡ Fast**: Direct API calls without browser automation
- **🛡️ Secure**: All credentials stored in environment variables

## 📋 Prerequisites

1. **Zerodha Kite Connect API App**

   - Create an app at [Kite Connect](https://kite.trade/connect/login)
   - Get your API Key and API Secret

2. **Zerodha Account with 2FA Enabled**
   - Your Zerodha User ID and Password
   - TOTP (Time-based One-Time Password) must be enabled on your account

## 🛠️ Setup Instructions

### Step 1: Get Your TOTP Secret

This is the most important step for automatic authentication:

1. **Login to Zerodha Kite**: Go to [https://kite.zerodha.com](https://kite.zerodha.com)
2. **Navigate to Settings**: Click on your profile → Settings → API
3. **Enable 2FA**: If not already enabled, enable 2FA (Two-Factor Authentication)
4. **Get the Secret**: When setting up 2FA, you'll see a QR code. Below or beside it, there's a text version of the secret key
5. **Copy the Secret**: The secret is in Base32 format (e.g., `ABCDEFGHIJKLMNOPQRSTUVWXYZ234567`)

### Step 2: Configure Environment Variables

1. **Copy the example file**:

   ```bash
   cp env.example .env
   ```

2. **Edit the `.env` file** with your credentials:

   ```env
   # Zerodha API Credentials
   ZERODHA_API_KEY=your_api_key_here
   ZERODHA_API_SECRET=your_api_secret_here

   # Zerodha Login Credentials
   ZERODHA_USER_ID=your_zerodha_user_id
   ZERODHA_PASSWORD=your_zerodha_password

   # TOTP Secret (REQUIRED for automatic authentication)
   ZERODHA_TOTP_SECRET=your_base32_totp_secret

   # Optional: Redirect URI
   ZERODHA_REDIRECT_URI=https://127.0.0.1
   ```

### Step 3: Test the Setup

Run the automatic authentication test:

```bash
npm run dev -- src/auth/auto-totp-example.ts
```

You should see output like:

```
🚀 Zerodha Automatic TOTP Authentication Example

🔐 Starting Automatic TOTP Authentication...
📋 Step 1: Establishing session...
✅ Session established
📋 Step 2: Sending credentials...
✅ Credentials accepted
📋 Step 3: Generating TOTP automatically...
✅ TOTP generated: 123456
✅ TOTP authentication completed
📋 Step 4: Extracting request token...
✅ Request token extracted successfully
📋 Step 5: Generating access token...

🎉 Automatic TOTP Authentication completed successfully!
```

## 🔧 Usage Examples

### Basic Usage with Environment Variables

```typescript
import { createAutoTOTPAuth } from "./src/auth/easy-auth";

async function main() {
  // This automatically reads from environment variables
  const auth = await createAutoTOTPAuth();

  // Authentication is already complete!
  const session = auth.getSession();
  console.log("User ID:", session?.userId);

  // Make API calls
  const profile = await auth.apiCall("/user/profile");
  console.log("Profile:", profile.data.user_name);
}
```

### Advanced Usage with Direct Configuration

```typescript
import { AutoTOTPZerodhaAuth } from "./src/auth/easy-auth";

async function main() {
  const auth = new AutoTOTPZerodhaAuth({
    apiKey: "your_api_key",
    apiSecret: "your_api_secret",
    userId: "your_user_id",
    password: "your_password",
    totpSecret: "your_base32_totp_secret",
  });

  await auth.authenticate();

  // Make API calls
  const margins = await auth.apiCall("/user/margins");
  console.log("Available cash:", margins.data.equity.available.cash);
}
```

### Integration with Trading Bot

```typescript
import { createAutoTOTPAuth } from "./src/auth/easy-auth";

class TradingBot {
  private auth: AutoTOTPZerodhaAuth;

  async initialize() {
    // Automatic authentication
    this.auth = await createAutoTOTPAuth();
    console.log("✅ Bot authenticated and ready to trade!");
  }

  async placeOrder() {
    const order = await this.auth.apiCall("/orders/regular", "POST", {
      exchange: "NSE",
      tradingsymbol: "RELIANCE",
      transaction_type: "BUY",
      quantity: 1,
      order_type: "MARKET",
      product: "CNC",
    });

    console.log("Order placed:", order.data.order_id);
  }
}
```

## 🔒 Security Features

### Session Management

- Sessions are automatically saved to `data/zerodha-auto-session.json`
- Sessions are validated before use
- Expired sessions trigger automatic re-authentication

### Automatic Re-authentication

- If an API call fails due to session expiry, the system automatically:
  1. Clears the expired session
  2. Performs fresh authentication
  3. Retries the original API call

### Secure Storage

- All credentials are stored in environment variables
- Session files are stored locally and not transmitted
- TOTP secrets are never logged or exposed

## 🐛 Troubleshooting

### Common Issues

1. **"TOTP secret is required"**

   - Solution: Make sure `ZERODHA_TOTP_SECRET` is set in your `.env` file
   - Verify the secret is in Base32 format

2. **"Invalid TOTP code"**

   - Solution: Check your system time is accurate
   - Verify the TOTP secret is correct

3. **"Login failed"**

   - Solution: Check your User ID and Password
   - Ensure your account has 2FA enabled

4. **"Missing required environment variables"**
   - Solution: Verify all required variables are set in `.env`:
     - `ZERODHA_API_KEY`
     - `ZERODHA_API_SECRET`
     - `ZERODHA_USER_ID`
     - `ZERODHA_PASSWORD`
     - `ZERODHA_TOTP_SECRET`

### Debug Mode

Enable detailed logging by setting:

```env
LOG_LEVEL=debug
```

### Test Your Setup

Run the comprehensive test:

```bash
npm run dev -- src/auth/auto-totp-example.ts
```

## 📊 API Usage Examples

Once authenticated, you can use any Zerodha API endpoint:

```typescript
// Get user profile
const profile = await auth.apiCall("/user/profile");

// Get account margins
const margins = await auth.apiCall("/user/margins");

// Get portfolio holdings
const holdings = await auth.apiCall("/portfolio/holdings");

// Get current positions
const positions = await auth.apiCall("/portfolio/positions");

// Place an order
const order = await auth.apiCall("/orders/regular", "POST", {
  exchange: "NSE",
  tradingsymbol: "RELIANCE",
  transaction_type: "BUY",
  quantity: 1,
  order_type: "MARKET",
  product: "CNC",
});

// Cancel an order
const cancelResult = await auth.apiCall("/orders/regular/ORDER_ID", "DELETE");
```

## 🚀 Performance Benefits

- **No Browser Automation**: Direct API calls are much faster
- **Session Reuse**: Avoid repeated authentication for 24 hours
- **Automatic Retry**: Seamless handling of session expiry
- **Zero Manual Input**: Fully automated workflow

## 📁 File Structure

```
src/auth/
├── easy-auth.ts              # Main automatic TOTP authentication class
├── auto-totp-example.ts      # Example usage and testing
└── data/
    └── zerodha-auto-session.json  # Saved session (auto-generated)
```

## 🔄 Migration from Manual Auth

If you're upgrading from manual authentication methods:

1. **Replace old imports**:

   ```typescript
   // Old
   import { EasyZerodhaAuth } from "./easy-auth";

   // New
   import { AutoTOTPZerodhaAuth, createAutoTOTPAuth } from "./easy-auth";
   ```

2. **Update configuration**:

   - Add `ZERODHA_TOTP_SECRET` to your `.env` file
   - Remove any manual input handling code

3. **Use the new API**:

   ```typescript
   // Old
   const auth = new EasyZerodhaAuth(config);
   await auth.authenticate(); // This required manual TOTP input

   // New
   const auth = await createAutoTOTPAuth(); // Fully automatic!
   ```

## 🎯 Best Practices

1. **Environment Variables**: Always use `.env` file for credentials
2. **Session Management**: Let the system handle session persistence
3. **Error Handling**: The system handles most errors automatically
4. **Security**: Never commit `.env` files to version control
5. **Testing**: Use the example file to verify your setup

---

**🎉 Congratulations!** You now have a fully automatic TOTP-based authentication system for Zerodha trading. No more manual TOTP entry required!
