import 'dotenv/config';
import 'reflect-metadata';

import type {
    IncomingMessage,
    ServerResponse,
} from 'node:http';

import type { Request, Response } from 'express';
import express from 'express';

import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';

import { AppModule } from '../src/app.module';

type RequestLike = {
    url: string;
    path?: string;
    method?: string;
};

type ResponseLike = {
    statusCode?: number;
    on?: (event: 'finish', listener: () => void) => void;
};

type NextLike = () => void;

type ExpressHandler = (req: Request, res: Response) => unknown;

let cachedHandler: ExpressHandler | null = null;

async function getHandler(): Promise<ExpressHandler> {
    if (cachedHandler) {
        return cachedHandler;
    }

    const expressApp = express();
    expressApp.disable('x-powered-by');

    // Vercel Analytics – track each API request with path and method
    // Uses dynamic import because @vercel/analytics/server is ESM-only
    expressApp.use((req: unknown, res: unknown, next: unknown) => {
        const request = req as RequestLike;
        const response = res as ResponseLike;
        const nextFn = next as NextLike;

        response.on?.('finish', () => {
            import('@vercel/analytics/server')
                .then(({ track }) =>
                    track('api_request', {
                        path: request.path || request.url,
                        method: request.method || 'UNKNOWN',
                        status: String(response.statusCode ?? ''),
                    }),
                )
                .catch(() => { });
        });

        nextFn();
    });

    expressApp.use((req: unknown, _res: unknown, next: unknown) => {
        const request = req as RequestLike;
        const nextFn = next as NextLike;

        if (request.url === '/api') {
            request.url = '/';
        } else if (request.url.startsWith('/api/')) {
            request.url = request.url.slice('/api'.length) || '/';
        }

        nextFn();
    });

    const app = await NestFactory.create(
        AppModule,
        new ExpressAdapter(expressApp),
        { logger: ['error', 'warn', 'log'] },
    );

    await app.init();
    cachedHandler = expressApp as unknown as ExpressHandler;
    return cachedHandler;
}

export default async function handler(
    req: IncomingMessage | Request,
    res: ServerResponse | Response,
) {
    const appHandler = await getHandler();
    return appHandler(req as Request, res as Response);
}
