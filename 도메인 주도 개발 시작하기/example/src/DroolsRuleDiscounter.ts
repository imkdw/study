import { OrderLine } from "./OrderLine.js";
import { RuleDiscounter } from "./RuleDiscounter.js";

export class DroolsRuleDiscounter implements RuleDiscounter {
  private kContainer: KieContainer;

  constructor() {
    const ks = KieServices.Factory.get();
    this.kContainer = ks.getKieClasspathContainer();
  }

  applyRules(customer: Customer, orderLines: OrderLine[]) {
    const kSession = this.kContainer.newKieSession("discountSession");
    try {
      // ...
      kSession.fireAllRules();
    } finally {
      kSession.dispose();
    }

    return money.toImmutableMoney();
  }
}
