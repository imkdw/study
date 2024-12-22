class CommandIssuedEvent implements IDomainEvent {
  constructor(
    public readonly target: Target,
    public readonly command:
      | SubmitAdvertisementCommand
      | TrackConfirmation
      | TrackRejection,
    public readonly campaignId: number
  ) {}
}

interface AdvertisingMaterial {
  // 광고 자료 관련 속성들...
}

// 메인 Saga 클래스
class CampaignPublishingSaga {
  constructor(
    private readonly repository: ICampaignRepository,
    private readonly events: IDomainEvent[] = []
  ) {}

  process(event: CampaignActivated): void;
  process(event: PublishingConfirmed): void;
  process(event: PublishingRejected): void;
  process(
    event: CampaignActivated | PublishingConfirmed | PublishingRejected
  ): void {
    if (event instanceof CampaignActivated) {
      this.processCampaignActivated(event);
    } else if (event instanceof PublishingConfirmed) {
      this.processPublishingConfirmed(event);
    } else if (event instanceof PublishingRejected) {
      this.processPublishingRejected(event);
    }
  }

  private processCampaignActivated(activated: CampaignActivated): void {
    const campaign = this.repository.load(activated.campaignId);
    const advertisingMaterials = campaign.generateAdvertisingMaterials();
    const commandIssuedEvent = new CommandIssuedEvent(
      Target.PublishingService,
      new SubmitAdvertisementCommand(
        activated.campaignId,
        advertisingMaterials
      ),
      activated.campaignId
    );

    this.events.push(activated);
    this.events.push(commandIssuedEvent);
  }

  private processPublishingConfirmed(confirmed: PublishingConfirmed): void {
    const commandIssuedEvent = new CommandIssuedEvent(
      Target.CampaignAggregate,
      new TrackConfirmation(confirmed.campaignId, confirmed.confirmationId),
      confirmed.campaignId
    );

    this.events.push(confirmed);
    this.events.push(commandIssuedEvent);
  }

  private processPublishingRejected(rejected: PublishingRejected): void {
    const commandIssuedEvent = new CommandIssuedEvent(
      Target.CampaignAggregate,
      new TrackRejection(rejected.campaignId, rejected.rejectionReason),
      rejected.campaignId
    );

    this.events.push(rejected);
    this.events.push(commandIssuedEvent);
  }
}
