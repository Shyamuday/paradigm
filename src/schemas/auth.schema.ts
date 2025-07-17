import { z } from 'zod';

// Login credentials schema
export const LoginCredentialsSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  apiSecret: z.string().min(1, 'API secret is required'),
  userId: z.string().min(1, 'User ID is required'),
  password: z.string().min(1, 'Password is required'),
  pin: z.string().length(6, 'PIN must be 6 digits').regex(/^\d{6}$/, 'PIN must contain only digits'),
  totp: z.string().optional(), // Optional for TOTP if enabled
});

// Zerodha login response schema
export const ZerodhaLoginResponseSchema = z.object({
  status: z.enum(['success', 'error']),
  data: z.object({
    user_id: z.string(),
    user_name: z.string(),
    user_shortname: z.string().optional(),
    email: z.string().email().optional(),
    mobile: z.string().optional(),
    api_key: z.string(),
    access_token: z.string(),
    refresh_token: z.string().optional(),
    login_time: z.string(),
    exchange: z.string().optional(),
    order_types: z.array(z.string()).optional(),
    products: z.array(z.string()).optional(),
    broker: z.string().optional(),
    meta: z.object({
      demat_consent: z.string().optional(),
    }).optional(),
  }).optional(),
  message: z.string().optional(),
});

// Session data schema
export const SessionDataSchema = z.object({
  userId: z.string(),
  userName: z.string(),
  apiKey: z.string(),
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  loginTime: z.string(),
  exchange: z.string().optional(),
  orderTypes: z.array(z.string()).optional(),
  products: z.array(z.string()).optional(),
  broker: z.string().optional(),
  meta: z.object({
    dematConsent: z.string().optional(),
  }).optional(),
});

// Access token validation response
export const AccessTokenValidationSchema = z.object({
  status: z.enum(['success', 'error']),
  data: z.object({
    user_id: z.string(),
    user_name: z.string(),
    user_shortname: z.string().optional(),
    email: z.string().email().optional(),
    mobile: z.string().optional(),
    api_key: z.string(),
    login_time: z.string(),
    exchange: z.string().optional(),
    order_types: z.array(z.string()).optional(),
    products: z.array(z.string()).optional(),
    broker: z.string().optional(),
  }).optional(),
  message: z.string().optional(),
});

// Error response schema
export const ZerodhaErrorResponseSchema = z.object({
  status: z.literal('error'),
  error_type: z.string(),
  message: z.string(),
  data: z.any().optional(),
});

// Union type for all Zerodha responses
export const ZerodhaResponseSchema = z.union([
  ZerodhaLoginResponseSchema,
  AccessTokenValidationSchema,
  ZerodhaErrorResponseSchema,
]);

// Types inferred from schemas
export type LoginCredentials = z.infer<typeof LoginCredentialsSchema>;
export type ZerodhaLoginResponse = z.infer<typeof ZerodhaLoginResponseSchema>;
export type SessionData = z.infer<typeof SessionDataSchema>;
export type AccessTokenValidation = z.infer<typeof AccessTokenValidationSchema>;
export type ZerodhaErrorResponse = z.infer<typeof ZerodhaErrorResponseSchema>;
export type ZerodhaResponse = z.infer<typeof ZerodhaResponseSchema>; 