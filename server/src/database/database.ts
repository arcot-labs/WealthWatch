import { DatabaseError } from '@models'
import { logger, vars } from '@utilities'
import pg, { PoolClient, QueryResult, QueryResultRow } from 'pg'

let clientPool: pg.Pool | undefined

export const createPool = async (): Promise<void> => {
    logger.debug('creating database pool')
    const config: pg.PoolConfig = {
        host: vars.dbHost,
        port: parseInt(vars.dbPort),
        database: vars.dbName,
        user: vars.dbUser,
        password: vars.dbPassword,
        max: 20,
        allowExitOnIdle: true,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
        maxUses: 7500,
    }
    clientPool = new pg.Pool(config)
    try {
        await runQuery('SELECT 1')
        logger.debug('created database pool')
    } catch {
        throw new DatabaseError('failed to create database pool')
    }
}

export const getPool = (): pg.Pool => {
    if (!clientPool) throw new DatabaseError('database pool not initialized')
    return clientPool
}

export const stopPool = async (): Promise<void> => {
    logger.debug('stopping database pool')
    if (!clientPool) {
        logger.warn('database pool not initialized')
        return
    }
    if (clientPool.ended) {
        logger.warn('database pool already stopped')
        return
    }
    await clientPool.end()
    logger.debug('stopped database pool')
}

/** @knipignore */
export const beginTransaction = async (): Promise<PoolClient> => {
    const client = await getPool().connect()
    await runQuery('BEGIN', [], client)
    return client
}

/** @knipignore */
export const commitTransaction = async (client: PoolClient): Promise<void> => {
    try {
        await runQuery('COMMIT', [], client)
    } finally {
        client.release()
    }
}

/** @knipignore */
export const rollbackTransaction = async (
    client: PoolClient
): Promise<void> => {
    try {
        await runQuery('ROLLBACK', [], client)
    } finally {
        client.release()
    }
}

export const constructInsertQueryParamsPlaceholder = (
    rowCount: number,
    paramCount: number,
    counter = 1
): string => {
    if (rowCount < 1 || paramCount < 1)
        throw new DatabaseError('cannot construct parameters placeholder')

    const placeholders: string[] = []
    for (let i = 0; i < rowCount; i++) {
        const paramList: string[] = []
        for (let j = 0; j < paramCount; j++) {
            paramList.push(`$${String(counter++)}`)
        }
        placeholders.push(`(${paramList.join(', ')})`)
    }
    return ` ${placeholders.join(', ')} `
}

export const runQuery = async <T extends QueryResultRow>(
    query: string,
    params: unknown[] = [],
    client: PoolClient | null = null,
    skipSuccessLog = false
): Promise<QueryResult<T>> => {
    const start = Date.now()

    // replace whitespace with single space
    query = query.replace(/\s+/g, ' ').trim()

    // collapse `VALUES ($1, $2, $3), ($4, $5, $6)` into `VALUES (2 x 3)`
    let collapsedQuery = query
    if (/^insert/i.exec(query)) {
        // parameterized value rows
        const rows = query.match(/\(\s*(\$\d+(\s*,\s*\$\d+)*)\s*\)/g)
        if (rows) {
            const rowCount = rows.length
            const paramCount = rows[0]
                .replace('(', '')
                .replace(')', '')
                .split(',').length

            const parameterizedValues =
                /values\s*\(\s*(\$\d+(\s*,\s*\$\d+)*)\s*\)(\s*,\s*\(\s*(\$\d+(\s*,\s*\$\d+)*)\s*\))*\s*/i
            const valuesPlaceholder = `VALUES (${String(rowCount)} x ${String(paramCount)}) `
            collapsedQuery = query
                .replace(parameterizedValues, valuesPlaceholder)
                .trim()
        }
    }

    try {
        const res = client
            ? await client.query(query, params)
            : await getPool().query(query, params)
        const queryLog = {
            duration: Date.now() - start,
            query: collapsedQuery,
            rowCount: res.rowCount,
        }
        if (
            /^(select|insert|update|delete)\b/i.test(query) &&
            res.rowCount === null
        ) {
            throw new DatabaseError('unexpected null row count')
        }
        if (!skipSuccessLog) logger.debug({ queryLog }, 'executed query')
        return res
    } catch (error) {
        const queryLog = {
            duration: Date.now() - start,
            query: collapsedQuery,
            error,
        }
        logger.error({ queryLog }, 'failed to execute query')
        throw error
    }
}
