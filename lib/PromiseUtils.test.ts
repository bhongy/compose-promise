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

    it('skips all functions after the function that rejectes the promise', async () => {
      expect.assertions(8);

      const initial = 0;
      const vs = [1, 5, 10, 50, 100];
      const ps = vs.map((v: number, i: number) =>
        i === 2
          ? jest.fn().mockRejectedValue(Error('something went wrong'))
          : jest.fn((prev: number) => delay(100).then(() => prev + v))
      );

      try {
        await serial(ps, initial);
      } catch (e) {
        expect(ps[0]).toHaveBeenCalled();
        expect(ps[0]).toHaveBeenCalledWith(initial);

        expect(ps[1]).toHaveBeenCalled();
        expect(ps[1]).toHaveBeenCalledWith(initial + vs[0]);

        expect(ps[2]).toHaveBeenCalled();
        expect(ps[2]).toHaveBeenCalledWith(initial + vs[0] + vs[1]);

        expect(ps[3]).not.toHaveBeenCalled();
        expect(ps[4]).not.toHaveBeenCalled();
      }
    });
  });
});
