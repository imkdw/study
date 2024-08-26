const watchedList = [];
watchedList.push(socketA, FOR_READ);
watchedList.push(fileB, FOR_READ);

while ((events = demultiplexer.watch(watchedList))) {
  for (const event of events) {
    data = event.resource.read();
    if (data === "RESOURCE_CLOSED") {
      demultiplexer.unwatch(event.resource);
    } else {
      consumeData(data);
    }
  }
}
