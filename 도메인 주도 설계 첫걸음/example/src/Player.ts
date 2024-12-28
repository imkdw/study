export class Player {
  private id: string;
  private points: number;

  constructor() {}
}

export class ApplyBonus {
  private playerRepository: PlayerRepository;

  execute(playerId: string, percentage: number) {
    const player = this.playerRepository.load(playerId);
    player.points += player.points * (percentage / 100);
    this.playerRepository.commitChanges(player);
  }
}
