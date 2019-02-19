import * as http from 'http';
import { serial } from '../lib/PromiseUtils';

const delay = (duration: number): Promise<undefined> =>
  new Promise(resolve => setTimeout(resolve, duration));

interface Middleware {
  // prettier-ignore
  (
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): <T>(context: T) => Promise<T>;
}

const serialMiddleware = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  context: {},
  middlewareStack: Array<Middleware>
) =>
  serial(
    middlewareStack.map(middleware => middleware(req, res)),
    Promise.resolve(context)
  );

describe('Example: Middleware', () => {
  test('(temporary) server test works', async () => {
    expect.assertions(1);

    const server = http.createServer();
    const requestHandled = new Promise(resolve => {
      server.on('request', (req, res) => resolve(res));
    });

    await delay(100);
    server.emit('request', {}, { foo: 'bar' });

    return expect(requestHandled).resolves.toEqual({ foo: 'bar' });
  });

  it('passes async calls through the stack in success case', () => {
    expect.assertions(1);

    const server = http.createServer();
    const middlewares = [authMiddleware, cspMiddleware, userMiddleware];
    const requestHandled = new Promise(resolve => {
      server.on('request', async (req, res) => {
        const context = await serialMiddleware(req, res, {}, middlewares);
        resolve(context);
      });
    });

    delay(100).then(() => {
      const req = { auth: 'fake-auth-session-id' };
      const res = {};
      server.emit('request', req, res);
    });

    return expect(requestHandled).resolves.toEqual({
      authenticated: true,
      cspToken: '1234',
      user: null,
    });
  });

  it('allows catching promise rejection if a middleware "throws"', () => {
    expect.assertions(1);

    const server = http.createServer();
    const middlewares = [securityMiddleware, authMiddleware, cspMiddleware];
    const requestHandled = new Promise((resolve, reject) => {
      server.on('request', (req, res) => {
        serialMiddleware(req, res, {}, middlewares).then(
          context => {
            resolve(context);
          },
          error => {
            reject(error);
          }
        );
      });
    });

    delay(100).then(() => {
      const req = { isDanger: true };
      const res = {};
      server.emit('request', req, res);
    });

    return expect(requestHandled).rejects.toThrow(SecurityViolationError);
  });
});

/** Fake Middlewares for Testing */

const authMiddleware: Middleware = (
  req: http.IncomingMessage & { auth?: boolean },
  res
) => async context =>
  req.auth ? { ...context, authenticated: true } : context;

const cspMiddleware: Middleware = (req, res) => async context => ({
  ...context,
  cspToken: '1234',
});

class SecurityViolationError extends Error {}
const securityMiddleware: Middleware = (
  req: http.IncomingMessage & { isDanger?: boolean },
  res
) => async context => {
  if (req.isDanger === true) {
    throw new SecurityViolationError('Yikes!');
  }
  return context;
};

// async function is just a sugar that helps unnesting .then expressions
// and ensure the function always return a promise (never throws)
const userMiddleware: Middleware = (req, res) => context => {
  const fetchUserThatAlwaysFail = (userId: string) =>
    Promise.reject({ statusCode: 404, error: 'User not found.' });

  return fetchUserThatAlwaysFail('winnie-the-pooh').then(
    ({ payload }) => ({ ...context, user: payload }),
    // a middleware that has baked-in recovery from promise rejection
    // it will always resolved
    () => ({ ...context, user: null })
  );
};
