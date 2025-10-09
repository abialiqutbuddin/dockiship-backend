import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  DATABASE_URL: Joi.string().uri().required(),
  JWT_SECRET: Joi.string().min(8).required(),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
});