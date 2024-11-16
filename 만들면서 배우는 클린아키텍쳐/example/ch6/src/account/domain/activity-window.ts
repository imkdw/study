import Activity from './activity.js';

export default class ActivityWindow {
  private readonly activities: Activity[];

  getActivities() {
    return this.activities;
  }
}
