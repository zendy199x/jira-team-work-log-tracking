import type { IncomingMessage, ServerResponse } from 'node:http';
import handler from './_handler';

export default async function apiIndex(req: IncomingMessage, res: ServerResponse) {
    return handler(req, res);
}
