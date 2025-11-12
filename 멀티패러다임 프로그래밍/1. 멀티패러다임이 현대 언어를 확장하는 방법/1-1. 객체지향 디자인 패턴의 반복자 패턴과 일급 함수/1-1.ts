/**
 * 반복자가 아직 완료되지 않음
 */
interface IteratorYieldResult<T> {
  done?: false;
  value: T;
}

/**
 * 반복자가 완료됨
 */
interface IteratorReturnResult {
  done: true;
  value: undefined;
}

/**
 * next()를 가진 인터페이스로 반복자가 완료됬거나 아직 완료되지 않았음을 반환
 */
interface Iterator<T> {
  next(): IteratorYieldResult<T> | IteratorReturnResult;
}
