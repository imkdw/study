export default class Screening {
  private movie: Movie;
  private sequence: number;
  private whenScreened: LocalTime;

  constructor(movie: Movie, sequence: number, whenScreened: Date) {
    this.movie = movie;
    this.sequence = sequence;
    this.whenScreened = whenScreened;
  }

  reserve(customer: Customer, audienceCount: number): Reservation {
    return new Reservation(
      customer,
      this,
      this.calculateFee(audienceCount),
      audienceCount
    );
  }

  getSequence(): number {
    return this.sequence;
  }

  getWhenScreened(): LocalTime {
    return this.whenScreened;
  }

  private calculateFee(audienceCount: number): Money {
    return this.movie.calculateFee(this).times(audienceCount);
  }
}
