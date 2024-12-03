import Customer from "./customer";
import Money from "./money";
import Movie from "./movie";
import Reservation from "./reservation";

/**
 * 상영을 구현하는 클래스
 *
 * 상영할 영화, 순번, 상영 시작시간을 포함함
 */
export default class Screening {
  private movie: Movie;
  private sequence: number;
  private whenScreened: Date;

  constructor(movie: Movie, sequence: number, whenScreened: Date) {
    this.movie = movie;
    this.sequence = sequence;
    this.whenScreened = whenScreened;
  }

  getStartTime(): Date {
    return this.whenScreened;
  }

  isSequence(sequence: number): boolean {
    return this.sequence === sequence;
  }

  getMovieFee(): Money {
    return this.movie.getFee();
  }

  /**
   * 영화를 예매함
   * @param customer 예매자에 대한 정보
   * @param audienceCount 인원수
   * @returns 예매 정보를 담은 정보 반환
   */
  reserve(customer: Customer, audienceCount: number) {
    return new Reservation(customer, this, this.calculateFee(audienceCount), audienceCount);
  }

  /**
   * 예매를 위한 요금을 계산
   * @param audienceCount 인원 수
   * @returns
   */
  private calculateFee(audienceCount: number): Money {
    /**
     * 영화 가격을 가져오고 인원수를 곱하면 예메 가격이
     */
    return this.movie.calculateMoviePrice(this).times(audienceCount);
  }
}
