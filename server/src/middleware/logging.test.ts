import { NextFunction, Request, Response } from 'express'
import { Session } from 'express-session'
import { Socket } from 'node:net'
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest'

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
})

describe('logRequestResponse', () => {
    const mockMethod = 'GET'
    const mockBaseUrl = '/api'
    const mockPath = '/mock-url'
    const mockUrl = mockBaseUrl + mockPath
    const mockQuery = { foo: 'bar' }
    const mockParams = { id: '1' }
    const mockReqBody = { reqKey: 'value' }
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const mockReqHeaders = { 'req-header': 'value' }
    const mockUserId = 123
    const mockSession = {
        user: { id: mockUserId },
    } as unknown as Session
    const mockRemoteAddress = '127.0.0.1'
    const mockRemotePort = 8080
    const mockSocket: Socket = {
        remoteAddress: mockRemoteAddress,
        remotePort: mockRemotePort,
    } as unknown as Socket
    const mockStatus = 200
    const mockResBody = { resKey: 'value' }
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const mockResHeaders = { 'res-header': 'value' }
    const mockError = new Error('queue failure')

    const req: Partial<Request> = {
        method: mockMethod,
        baseUrl: mockBaseUrl,
        path: mockPath,
        url: mockUrl,
        query: mockQuery,
        params: mockParams,
        body: mockReqBody,
        headers: mockReqHeaders,
        session: mockSession,
        socket: mockSocket,
    }
    const res: Partial<Response> = {
        statusCode: mockStatus,
        getHeaders: () => mockResHeaders,
        on: vi.fn(),
        send: vi.fn().mockReturnThis(),
    }
    const next: NextFunction = vi.fn()

    beforeEach(() => {
        vi.doMock('../utilities/logger', () => ({
            logger: {
                info: vi.fn(),
                error: vi.fn(),
            },
        }))
        vi.doMock('../queues/index.ts', () => ({
            queueLogAppRequest: vi.fn().mockResolvedValue(undefined),
        }))
    })

    it('logs request and response info', async () => {
        const { logRequestResponse } = await import('./logging.js')
        const { queueLogAppRequest } = await import('@queues')
        const { logger } = await import('@utilities')

        logRequestResponse(req as Request, res as Response, next)

        const wrappedSend = res.send as unknown as (body: unknown) => unknown
        wrappedSend.call(res, mockResBody)
        // @ts-expect-error: custom property
        expect(res._body).toEqual(mockResBody)
        expect(res.send).toHaveBeenCalledExactlyOnceWith(mockResBody)

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const finishHandler = (res.on as Mock).mock.calls.find(
            ([event]) => event === 'finish'
        )?.[1]
        expect(finishHandler).toBeDefined()
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        finishHandler?.()

        expect(logger.info).toHaveBeenCalledTimes(2)
        expect(logger.info).toHaveBeenNthCalledWith(
            1,
            expect.stringMatching(
                new RegExp(
                    `received request \\(id \\d+-\\d+\\) - ${mockMethod} ${mockUrl}`
                )
            )
        )
        expect(logger.info).toHaveBeenNthCalledWith(
            2,
            expect.stringMatching(/sending response \(id \d+-\d+\)/)
        )

        expect(queueLogAppRequest).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({
                id: -1,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                requestId: expect.stringMatching(/^\d+-\d+$/),
                userId: mockUserId,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                timestamp: expect.any(Date),
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                duration: expect.any(Number),
                method: mockMethod,
                url: mockUrl,
                queryParams: mockQuery,
                routeParams: mockParams,
                requestHeaders: mockReqHeaders,
                requestBody: mockReqBody,
                remoteAddress: mockRemoteAddress,
                remotePort: mockRemotePort,
                session: mockSession,
                responseStatus: mockStatus,
                responseHeaders: mockResHeaders,
                responseBody: mockResBody,
            })
        )

        expect(next).toHaveBeenCalledOnce()
    })

    it('handles missing optional fields', async () => {
        const { logRequestResponse } = await import('./logging.js')
        const { queueLogAppRequest } = await import('@queues')

        req.session = {} as unknown as Session
        req.socket = {} as unknown as Socket

        logRequestResponse(req as Request, res as Response, next)

        const wrappedSend = res.send as unknown as (body: unknown) => unknown
        wrappedSend.call(res, mockResBody)

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const finishHandler = (res.on as Mock).mock.calls.find(
            ([event]) => event === 'finish'
        )?.[1]
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        finishHandler?.()

        expect(queueLogAppRequest).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({
                userId: null,
                remoteAddress: null,
                remotePort: null,
            })
        )
    })

    it('handles errors in queueLogAppRequest', async () => {
        vi.doMock('../queues/index.ts', () => ({
            queueLogAppRequest: vi.fn().mockRejectedValue(mockError),
        }))

        const { logRequestResponse } = await import('./logging.js')
        const { logger } = await import('@utilities')

        logRequestResponse(req as Request, res as Response, next)

        const wrappedSend = res.send as unknown as (body: unknown) => unknown
        wrappedSend.call(res, mockResBody)

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const finishHandler = (res.on as Mock).mock.calls.find(
            ([event]) => event === 'finish'
        )?.[1]
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        finishHandler?.()

        await vi.waitFor(() => {
            expect(logger.error).toHaveBeenCalledExactlyOnceWith(
                mockError,
                'failed to queue log app request'
            )
        })
    })
})
