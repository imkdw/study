const delay = <T>(time: number, value: T): Promise<T> => new Promise((resolve) => setTimeout(resolve, time, value));

type MyFile = {
  name: string;
  body: string;
  size: number;
};

async function getFile(name: string, size = 1000): Promise<MyFile> {
  console.log(`${name} 파일 다운로드 시작`);

  return delay<MyFile>(size, { name, body: "...", size });
}

async function executeWithLimit<T>(fs: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = [];

  for (let i = 0; i < fs.length; i += limit) {
    const chunk = fs.slice(i, i + limit);
    const chunkResults = await Promise.all(chunk.map((f) => f()));
    results.push(...chunkResults);
  }

  return results;
}

async function init() {
  console.time("init");

  console.timeEnd("init");
}

init();
