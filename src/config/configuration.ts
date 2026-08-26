export default () => ({
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'supersecretaccesskey_smart_hospital_access_2026',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'supersecretrefreshkey_smart_hospital_refresh_2026',
    accessExpiry: '15m',
    refreshExpiry: '7d',
  },
  cors: {
    patientFrontendUrl: process.env.PATIENT_FRONTEND_URL || 'http://localhost:4000',
    hospitalFrontendUrl: process.env.HOSPITAL_FRONTEND_URL || 'http://localhost:5000',
    adminFrontendUrl: process.env.ADMIN_FRONTEND_URL || 'http://localhost:6000',
  },
  external: {
    paymentProviderKey: process.env.PAYMENT_PROVIDER_KEY || 'pk_test_placeholder_key_value',
    paymentWebhookSecret: process.env.PAYMENT_WEBHOOK_SECRET || 'whsec_placeholder_webhook_secret',
    smsProviderKey: process.env.SMS_PROVIDER_KEY || 'sms_test_provider_key',
    emailProviderKey: process.env.EMAIL_PROVIDER_KEY || 'email_test_provider_key',
  }
});
