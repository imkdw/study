export class DataController {
  constructor(private readonly dataService: DataService) {}

  editForm(@Param("id") id: number) {
    const dl = this.dataService.getDataWithLock(id);

    return {
      dataLock: dl,
      data: dl.data,
    };
  }
}
