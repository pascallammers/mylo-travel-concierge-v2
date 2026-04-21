// https://env.t3.gg/docs/nextjs#create-your-schema
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const serverEnv = createEnv({
  server: {
    USE_XAI: z
      .string()
      .optional()
      .default('true')
      .transform((val) => val === 'true'),
    
    XAI_API_KEY: z.string().min(1),
    OPENAI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().min(1),
    GROQ_API_KEY: z.string().min(1),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1),
    DAYTONA_API_KEY: z.string().min(1),
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(1),
    GITHUB_CLIENT_ID: z.string().min(1),
    GITHUB_CLIENT_SECRET: z.string().min(1),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    TWITTER_CLIENT_ID: z.string().min(1),
    TWITTER_CLIENT_SECRET: z.string().min(1),
    REDIS_URL: z.string().min(1),
    UPSTASH_REDIS_REST_URL: z.string().min(1),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
    ELEVENLABS_API_KEY: z.string().optional(),
    TAVILY_API_KEY: z.string().min(1),
    EXA_API_KEY: z.string().min(1),
    EXA_SEARCH_TYPE: z
      .enum(['instant', 'auto', 'fast', 'hybrid', 'neural', 'keyword'])
      .optional()
      .default('instant'),
    VALYU_API_KEY: z.string().min(1),
    TMDB_API_KEY: z.string().min(1),
    YT_ENDPOINT: z.string().min(1),
    FIRECRAWL_API_KEY: z.string().min(1),
    PARALLEL_API_KEY: z.string().min(1),
    OPENWEATHER_API_KEY: z.string().min(1),
    GOOGLE_MAPS_API_KEY: z.string().min(1),
    AMADEUS_ENV: z.enum(['test', 'prod']).optional().default('test'),
    AMADEUS_API_KEY: z.string().min(1),
    AMADEUS_API_SECRET: z.string().min(1),
    // Duffel API (Flight Search) - optional for backwards compatibility
    DUFFEL_API_KEY: z.string().min(1).optional(),
    // ============================================
    // Travelpayouts (Flight Deals)
    // ============================================
    TRAVELPAYOUTS_API_TOKEN: z.string().min(1).optional(),
    TRAVELPAYOUTS_MARKER: z.string().min(1).optional(),
    CRON_SECRET: z.string().min(1),
    BLOB_READ_WRITE_TOKEN: z.string().min(1),
    SMITHERY_API_KEY: z.string().min(1),
    COINGECKO_API_KEY: z.string().min(1),
    QSTASH_TOKEN: z.string().min(1),
    RESEND_API_KEY: z.string().min(1),
    SUPERMEMORY_API_KEY: z.string().min(1),
    ALLOWED_ORIGINS: z.string().optional().default('http://localhost:3000'),
    // AwardWallet Integration
    AWARDWALLET_API_KEY: z.string().min(1),
    AWARDWALLET_CALLBACK_URL: z.string().url().optional(),
    AWARDWALLET_PROXY_URL: z.string().min(1).optional(),
    // ThriveCart Integration
    THRIVECART_API_KEY: z.string().min(1),
    THRIVECART_SECRET_WORD: z.string().min(1),
    THRIVECART_PRODUCT_ID: z.string().optional().default('5'),
    THRIVECART_ACCOUNT_ID: z.string().optional().default('never-economy-again'),
  },
  experimental__runtimeEnv: process.env,
});
