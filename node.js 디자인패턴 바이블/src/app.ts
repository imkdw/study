class Queue {
  private queue: any[] = [];

  dequeue() {
    return new Promise((res) => {
      res(this.queue);
    });
  }
}
