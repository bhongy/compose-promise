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

function createTestServer(
  handler: (
    resolve: Function,
    reject: Function
  ) => (req: http.IncomingMessage, res: http.ServerResponse) => void
) {
  const server = http.createServer();
  return {
    fakeRequest(req: {}, res: {}): void {
      server.emit('request', req, res);
    },
    requestHandled: new Promise((resolve, reject) => {
      server.once('request', handler(resolve, reject));
    }),
  };
}

describe('Example: Middleware', () => {
  test('(temporary) server test works', async () => {
    expect.assertions(1);

    const server = createTestServer(resolve => (req, res) => resolve(res));

    await delay(100);
    server.fakeRequest({}, { foo: 'bar' });

    return expect(server.requestHandled).resolves.toEqual({ foo: 'bar' });
  });

  it('passes async calls through the stack in success case', () => {
    expect.assertions(1);

    const middlewares = [authMiddleware, cspMiddleware, userMiddleware];
    const server = createTestServer(resolve => async (req, res) => {
      const context = await serialMiddleware(req, res, {}, middlewares);
      resolve(context);
    });

    delay(100).then(() => {
      const req = { auth: 'fake-auth-session-id' };
      const res = {};
      server.fakeRequest(req, res);
    });

    return expect(server.requestHandled).resolves.toEqual({
      authenticated: true,
      cspToken: '1234',
      user: null,
    });
  });

  it('allows catching promise rejection if a middleware "throws"', () => {
    expect.assertions(1);

    const middlewares = [securityMiddleware, authMiddleware, cspMiddleware];
    const server = createTestServer((resolve, reject) => (req, res) => {
      serialMiddleware(req, res, {}, middlewares).then(
        context => {
          resolve(context);
        },
        error => {
          reject(error);
        }
      );
    });

    delay(100).then(() => {
      const req = { isDanger: true };
      const res = {};
      server.fakeRequest(req, res);
    });

    return expect(server.requestHandled).rejects.toThrow(
      SecurityViolationError
    );
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
