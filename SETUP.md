# 🔧 Setup Guide for Zerodha Algo Trading Bot

## ✅ Current Status
- ✅ Project structure created
- ✅ Auth module implemented
- ✅ Your API Key configured: `4kii2cglymgxjpqq`

## 🔑 Missing Credentials
You need to add these credentials to complete the setup:

### 1. API Secret ✅
- ✅ **API Secret:** `fmapqarltxl0lhyetqeasfgjias6ov3h` (configured)

### 2. Request Token
- This is generated when you login to Zerodha
- You'll need to get this from Zerodha's login flow
- It's a one-time token for authentication

## 🚀 Quick Setup

### Option 1: Environment Variables
Create a `.env` file in the project root:
```env
ZERODHA_API_KEY=4kii2cglymgxjpqq
ZERODHA_API_SECRET=fmapqarltxl0lhyetqeasfgjias6ov3h
ZERODHA_REQUEST_TOKEN=your_request_token_here
```

### Option 2: Update Test File
Edit `src/auth/test-auth.ts` and replace:
```typescript
process.env.ZERODHA_API_SECRET = 'your_actual_api_secret';
process.env.ZERODHA_REQUEST_TOKEN = 'your_actual_request_token';
```

## 🧪 Test Authentication
Once you have the credentials:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the auth test:
   ```bash
   npx ts-node src/auth/test-auth.ts
   ```

## 📋 Next Steps
After authentication is working:
1. ✅ Market Data Module (WebSocket + Historical)
2. ✅ Strategy Engine
3. ✅ Risk Management
4. ✅ Order Management
5. ✅ Position Tracking
6. ✅ Dashboard

## 🔍 How to Get Request Token
1. Visit: https://kite.trade/connect/login
2. Login with your Zerodha credentials
3. You'll be redirected with a request token
4. Copy that token for the bot

## 📞 Need Help?
- Check Zerodha's API documentation
- Verify your app is "Active" in developer console
- Ensure your Client ID (XB7556) is correct 