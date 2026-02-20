import { EnvNameEnum } from '@wealthwatch-shared'
import { env } from 'process'

const getEnvVar = (key: string): string => {
    const val = env[key]
    if (val === undefined) throw Error(`missing env var ${key}`)
    return val
}

export const vars = {
    clientLogtailToken: getEnvVar('CLIENT_LOGTAIL_TOKEN'),
    serverLogtailToken: getEnvVar('SERVER_LOGTAIL_TOKEN'),
    redisHost: getEnvVar('REDIS_HOST'),
    dbHost: getEnvVar('DB_HOST'),
    dbPort: getEnvVar('DB_PORT'),
    dbName: getEnvVar('DB_NAME'),
    dbUser: getEnvVar('DB_USER'),
    dbPassword: getEnvVar('DB_PASSWORD'),
    csrfSecret: getEnvVar('CSRF_SECRET'),
    sessionSecret: getEnvVar('SESSION_SECRET'),
    plaidClientId: getEnvVar('PLAID_CLIENT_ID'),
    plaidSecret: getEnvVar('PLAID_SECRET'),
    plaidWebhookUrl: getEnvVar('PLAID_WEBHOOK_URL'),
    demoUser: getEnvVar('DEMO_USER'),
    logLevel: getEnvVar('LOG_LEVEL'),
    nodeEnv: getEnvVar('NODE_ENV'),
    plaidEnv: getEnvVar('PLAID_ENV'),
}
export const dev = (vars.nodeEnv as EnvNameEnum) === EnvNameEnum.Dev
export const stage = (vars.nodeEnv as EnvNameEnum) === EnvNameEnum.Stage
export const prod = (vars.nodeEnv as EnvNameEnum) === EnvNameEnum.Prod || stage

export const _envTest = { getEnvVar }
