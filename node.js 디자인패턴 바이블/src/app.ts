interface Product {
  id: string;
}

const CACHE_TTL = 1000;
const cache = new Map();

export function totalSales(product: Product) {
  const resultPromise = cache.get(product.id);
  cache.set(product.id, resultPromise);

  resultPromise.then(
    () => {
      setTimeout(() => {
        cache.delete(product.id);
      }, CACHE_TTL);
    },
    (err: unknown) => {
      cache.delete(product.id);
      throw err;
    }
  );

  return resultPromise;
}
