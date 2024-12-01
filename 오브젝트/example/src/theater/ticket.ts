/**
 * 티켓
 *
 * 공연을 관람하기 위해서는 초대장을 소지하고 있어야함
 */
export default class Ticket {
  private fee: number;

  getFee(): number {
    return this.fee;
  }
}
