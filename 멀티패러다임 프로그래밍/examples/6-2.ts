import { delay, range } from "@fxts/core";

function createAsyncTask(name: string, ms: number): () => Promise<string> {
  return () => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(name);
      }, ms);
    });
  };
}

class TaskRunner<T> {
  private f: () => Promise<T>;
  private _promise: Promise<T> | null = null;
  private _isDone = false;

  get promise() {
    return this._promise ?? this.run();
  }

  get isDone() {
    return this._isDone;
  }

  constructor(f: () => Promise<T>) {
    this.f = f;
  }

  /**
   * 작업 시작 로직을 명확하게 분리했음
   * 이를 통해서 Promise 생성과 완료 상태 갱신을 일관되게 처리가 가능함
   * 캡슐화를 통해 상태 관리가 직관적으로 이루어짐
   */
  async run() {
    if (this._promise) {
      return this._promise;
    } else {
      return (this._promise = this.f().then((res) => {
        this._isDone = true;
        return res;
      }));
    }
  }
}

function* map<A, B>(f: (value: A) => B, iterable: Iterable<A>): IterableIterator<B> {
  for (const value of iterable) {
    yield f(value);
  }
}

class TaskPool<T> {
  /**
   * 무한 반복을 지원하기 위해서 Array -> IterableIterator로 변경
   */
  private readonly tasksIterator: IterableIterator<TaskRunner<T>>;
  private readonly pool: TaskRunner<T>[] = [];
  poolSize: number;

  constructor(fs: Iterable<() => Promise<T>>, poolSize: number) {
    /**
     * Iterable를 받고 IterableIterator를 반환하는 map 함수를 통해서 설정함
     */
    this.tasksIterator = map((f) => new TaskRunner(f), fs);
    this.poolSize = poolSize;
  }

  setPoolSize(poolSize: number) {
    this.poolSize = poolSize;
  }

  private canExpandPool() {
    return this.pool.length < this.poolSize;
  }

  /**
   * 각 작업을 순차적으로 풀에 추가하고 poolSize 만큼 병렬로 수행하는 공통 로직을 담당함
   */
  async run(errorHandler: (err: unknown) => unknown) {
    const { pool, tasksIterator } = this;
    const tasks: TaskRunner<T>[] = [];

    while (true) {
      const { done, value: nextTask } = tasksIterator.next();
      if (!done) {
        pool.push(nextTask);
        tasks.push(nextTask);
        if (this.canExpandPool()) continue;
      }

      if (done && pool.length === 0) {
        break;
      }

      /**
       * 외부에서 주입한 에러 핸들링 함수를 연결함
       */
      await Promise.race(pool.map((task) => task.run())).catch(errorHandler);

      pool.splice(
        pool.findIndex((task) => task.isDone),
        1
      );
    }

    return tasks.map((task) => task.promise);
  }

  /**
   * Promise.all을 통해서 처리하는데 모든 작업이 성공적으로 완료될 때까지 대기하는 패턴을 구현함
   * 1개의 Promise라도 실패하면 그 즉시 전체가 실패함
   */
  async runAll() {
    return Promise.all(await this.run((err) => Promise.reject(err)));
  }

  /**
   * Promise.allSettled()로 처리하는데 모든 작업을 실패 여부와 상관없이 끝날 때까지 기다리고 결과를 하 번에 받아볼 수 있는 패턴을 적용함
   * () => undefined는 사실상 에러를 무시하는 방식으로 처리함
   * 마지막으로 allSettled를 통해서 성공/실패 결과 모두를 담은 배열을 얻을 수 있음
   */
  async runAllSettled() {
    return Promise.allSettled(await this.run(() => undefined));
  }
}

const poolSize = 2;

const tasks = [
  createAsyncTask("A", 1000),
  () => createAsyncTask("B", 500)().then(() => Promise.reject("NO!")),
  createAsyncTask("C", 800),
  createAsyncTask("D", 300),
  createAsyncTask("E", 1200),
];

async function runAllSettledTest() {
  const result = await new TaskPool(tasks, poolSize).runAllSettled();
  console.log(result);
}

// [
//   { status: 'fulfilled', value: 'A' },
//   { status: 'rejected', reason: 'NO!' },
//   { status: 'fulfilled', value: 'C' },
//   { status: 'fulfilled', value: 'D' },
//   { status: 'fulfilled', value: 'E' }
// ]
// await runAllSettledTest();

async function crawling(page: number) {
  console.log(`${page} 분석 시작`);
  await delay(page * 100);
  console.log(`${page} 분석 완료`);
  return page;
}

async function runAllSettledTest2() {
  const task = (page: number) => () => page === 7 ? Promise.reject(page) : crawling(page);

  const taskPool = new TaskPool(map(task, range(Infinity)), 5);

  /**
   * 중간에 작업이 실패하더라도 계속 진행시킴
   */
  void taskPool.runAllSettled();

  /**
   * 10초 뒤에 동시 작업량을 10으로 증가시킴
   */
  setTimeout(() => {
    taskPool.setPoolSize(10);
  }, 10_000);
}

// 0 분석 시작
// 1 분석 시작
// 2 분석 시작
// 3 분석 시작
// 4 분석 시작
// 0 분석 완료
// 5 분석 시작
// 1 분석 완료
// 6 분석 시작
// 2 분석 완료
// 8 분석 시작
// 3 분석 완료
// 9 분석 시작
// 4 분석 완료
// 10 분석 시작
// 5 분석 완료
// 11 분석 시작
// 6 분석 완료
// 12 분석 시작
// 8 분석 완료
// 13 분석 시작
// 9 분석 완료
// 14 분석 시작
await runAllSettledTest2();
