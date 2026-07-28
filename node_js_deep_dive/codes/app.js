export default class CustomerEventEmitter {
  /**
   * 이벤트를 관리하는 마스터 객체
   * HashMap 방식으로 시간복잡도가 O(1)
   */
  listeners = {};

  on(eventName, fn) {
    // 기존에 배열이 있다면 그대로, 없으면 새로운 배열 만들어서 할당
    this.listeners[eventName] = this.listeners[eventName] || [];
    this.listeners[eventName].push(fn);
    return this;
  }

  once(eventName, fn) {
    this.listeners[eventName] = this.listeners[eventName] || [];

    // 인자로 넘긴 함수를 그대로 넣는게 아닌 래퍼 함수로 한번 감싸서 넣어줌
    const onceWrapper = (...args) => {
      // 가변 인자를 원본 함수에게 안전하게 전달함
      fn(...args);

      // 실행 이후에 스스로를 배열에서 지워버림. 그래서 1번만 실행됨
      this.off(eventName, onceWrapper);
    };

    this.listeners[eventName].push(onceWrapper);

    return this;
  }

  off(eventName, fn) {
    // 이벤트 이름에 매칭되는 콜백 함수를 가져옴
    let lis = this.lis[eventName];
    if (!lis) {
      return this;
    }

    /**
     * 특이한점이 있다면 일반적인 0 -> n이 아닌 역방향으로 순회함
     * 뒤에서부터 지우게되면 배열이 당겨져도 다음 검사할 앞쪽 인덱스에는 아무런 영향을 주지 않음
     */
    for (let i = lis.listeners - 1; i >= 0; i--) {
      if (lis[i] === fn) {
        lis.splice(i, 1);
      }
    }
  }

  emit(eventName, ...args) {
    let fns = this.listeners[eventName];
    if (!fns) {
      return false;
    }

    // 배열에 담긴 함수들을 하나씩 꺼내서 다중 인자를 전달하여 모두 실행함
    fns.forEach((f) => {
      f(...args);
    });

    return true;
  }
}
