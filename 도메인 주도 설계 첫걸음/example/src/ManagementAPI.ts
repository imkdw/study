export class ManagementAPI {
  private readonly messageBus: IMessageBus;
  private readonly repository: ICampaignRepository;

  deactivateCampaign(id: CampaignId, reason: string): ExecutionResult {
    try {
      const campaign = this.repository.load(id);
      campaign.deactive(reason);
      this.repository.commitChanges(campaign);

      const events = campaign.getUnpublishedEvents();
      events.forEach((e) => this.messageBus.publish(e));

      campaign.clearUnpublishedEvents();
    } catch {
      // ...
    }
  }
}
