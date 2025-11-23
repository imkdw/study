import { fx, map, range, toArray } from "@fxts/core";

function delay<T>(time: number): Promise<undefined>;
function delay<T>(time: number, value: T): Promise<T>;
function delay<T>(time: number, value?: T): Promise<T | undefined> {
  return new Promise((resolve) => setTimeout(resolve, time, value));
}

type Payment = {
  pg_uid: string;
  store_order_id: number;
  amount: number;
};

const pgDatPaymentsPage: Payment[][] = [
  [
    { pg_uid: "PG11", store_order_id: 1, amount: 15000 },
    { pg_uid: "PG12", store_order_id: 2, amount: 15000 },
    { pg_uid: "PG13", store_order_id: 3, amount: 15000 },
  ],
  [
    { pg_uid: "PG14", store_order_id: 4, amount: 20000 },
    { pg_uid: "PG15", store_order_id: 5, amount: 20000 },
    { pg_uid: "PG16", store_order_id: 6, amount: 20000 },
  ],
  [
    { pg_uid: "PG17", store_order_id: 7, amount: 25000 },
    { pg_uid: "PG18", store_order_id: 8, amount: 25000 },
  ],
];

const pgApi = {
  async getPageCount() {
    console.log(`페이지 카운트 요청: https://api.pg.com/v1/pages`);
    await delay(50);
    return pgDatPaymentsPage.length;
  },

  async getPayments(page: number) {
    console.log(`결제 내역 요청: https://api.pg.com/v1/payments?page=${page}`);
    await delay(500);

    const payments = pgDatPaymentsPage[page - 1] ?? [];
    console.log(`${payments.length}개: ${payments.map((p) => p.pg_uid).join(", ") || "-"}`);

    return payments;
  },

  async cancelPayment(pg_uid: string) {
    console.log(`취소 요청: ${pg_uid}`);
    await delay(300);
    return {
      code: 200,
      message: `${pg_uid} 취소 완료`,
      pg_uid,
    };
  },
};

type Order = {
  id: number;
  amount: number;
  is_paid: boolean;
};

const StoreDB = {
  MAX_ORDERS_PER_REQUEST: 5,
  async getOrders(ids: number[]): Promise<Order[]> {
    if (ids.length > StoreDB.MAX_ORDERS_PER_REQUEST) {
      throw new Error(`주문은 한번에 ${StoreDB.MAX_ORDERS_PER_REQUEST}개 이상 조회할 수 없습니다.`);
    }

    console.log(`SELECT * FROM orders WHERE IN (${ids}) AND is_paid = true`);
    await delay(100);

    return [
      { id: 1, amount: 15000, is_paid: true },
      { id: 3, amount: 25000, is_paid: true },
      { id: 5, amount: 20000, is_paid: true },
      { id: 7, amount: 25000, is_paid: true },
      { id: 8, amount: 25000, is_paid: true },
    ];
  },
};

async function syncPayments() {
  /**
   * 결제의 총 페이지수 조회
   */
  const totalPaymentPages = await pgApi.getPageCount();

  /**
   * 1. PG사 결제 내역 조회
   * - 페이지 단위로 데이터 요청
   * - 결제 데이터 있는 모든 페이지를 가져와서 하나로 병합
   */
  console.time("GET_PAYMENTS");
  const payments = await fx(range(1, totalPaymentPages + 1)) // 실제 결제 페이지 수만큼 이터러블 생성
    .toAsync() // 비동기 작업으로 변환
    .map((page) => pgApi.getPayments(page)) // 결제 내역 가져오기
    .concurrent(totalPaymentPages) // 총 페이지의 개수만큼 병렬로 요청
    .flat() // 평탄화
    .toArray(); // 배열로 변환
  console.timeEnd("GET_PAYMENTS");

  // 페이지 카운트 요청: https://api.pg.com/v1/pages
  // 결제 내역 요청: https://api.pg.com/v1/payments?page=1
  // 결제 내역 요청: https://api.pg.com/v1/payments?page=2
  // 결제 내역 요청: https://api.pg.com/v1/payments?page=3
  // 3개: PG11, PG12, PG13
  // 3개: PG14, PG15, PG16
  // 2개: PG17, PG18
  // GET_PAYMENTS: 502.789ms

  /**
   * 2. PG사 결제 내역과 일치하는 커머스 플랫폼 주문 데이터 조회
   */
  const orders = await fx(payments)
    .map((payment) => payment.store_order_id)
    .chunk(StoreDB.MAX_ORDERS_PER_REQUEST)
    .toAsync()
    // SELECT * FROM orders WHERE IN (1,2,3,4,5) AND is_paid = true
    // SELECT * FROM orders WHERE IN (6,7,8) AND is_paid = true
    .flatMap(StoreDB.getOrders)
    .toArray();

  const ordersById = Object.fromEntries(map((order) => [order.id, order], orders));

  /**
   * 3. 누락된 결제 취소 및 환불 처리
   * - 주문 내역과 매칭되지 않은 PG사 결제를 추려냄
   * - 해당 결제 ID를 취소 API를 통해서 처리함
   */
  await fx(payments)
    .toAsync()
    .reject((payment) => ordersById[payment.store_order_id])
    .forEach(async (payment) => {
      const { message } = await pgApi.cancelPayment(payment.pg_uid);
      console.log(message);
    });
}

async function runScheduler() {
  /**
   * 무한 이터러블 지정
   */
  await fx(range(1, Infinity))
    /**
     * 비동기 작업으로 변경
     */
    .toAsync()

    /**
     * 10초를 대기하는 동시에 결제 동기화 작업을 진행함
     * 10초 보다 오래 걸리는 경우 동기화 작업이 끝난 시간 이후가 다시 작업을 들어가는 시점
     * 만약 10초 보다 빨리 끝난다면 10초까지 대기하고 다음 작업을 진행함
     */
    .forEach(() => Promise.all([syncPayments(), delay(10000)]));
}

await runScheduler();
