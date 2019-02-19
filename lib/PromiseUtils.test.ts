import { serial } from './PromiseUtils';

const delay = (duration: number): Promise<undefined> =>
  new Promise(resolve => setTimeout(resolve, duration));

describe('PromiseUtils', () => {
  describe('.serial', () => {
    it('passes the resolved value from the previous function to the next', async () => {
      expect.assertions(1);

      const p1 = (prev: string) => delay(100).then(() => `${prev}:foo`);
      const p2 = (prev: string) => delay(100).then(() => `${prev}:bar`);

      const result = await serial([p1, p2], 'init');

      expect(result).toBe('init:foo:bar');
    });

    it('does not execute the next function until the previous one resolves', async () => {
      expect.assertions(5);

      // TODO: figure out a better way to test this so it's: setup -> execute -> assertions
      const p1 = jest.fn(async () => {
        await delay(100);
        expect(p2).not.toHaveBeenCalled();
        expect(p3).not.toHaveBeenCalled();
      });

      const p2 = jest.fn(async () => {
        await delay(100);
        expect(p1).toHaveBeenCalledTimes(1);
        expect(p2).toHaveBeenCalledTimes(1);
        expect(p3).not.toHaveBeenCalled();
      });

      const p3 = jest.fn().mockReturnValue(delay(100));

      await serial([p1, p2, p3], null);
    });

    it('skips all functions after the function that rejectes the promise', async () => {
      expect.assertions(8);

      const ps = [1, 5, 10, 50, 100].map((v, i) =>
        i === 2
          ? jest.fn().mockRejectedValue(Error('something went wrong'))
          : jest.fn(prev => delay(100).then(() => prev + v))
      );

      try {
        await serial(ps, 0);
      } catch (e) {
        expect(ps[0]).toHaveBeenCalledTimes(1);
        expect(ps[0]).toHaveBeenCalledWith(0);

        expect(ps[1]).toHaveBeenCalledTimes(1);
        expect(ps[1]).toHaveBeenCalledWith(1);

        expect(ps[2]).toHaveBeenCalledTimes(1);
        expect(ps[2]).toHaveBeenCalledWith(6);

        expect(ps[3]).not.toHaveBeenCalled();
        expect(ps[4]).not.toHaveBeenCalled();
      }
    });
  });
});
