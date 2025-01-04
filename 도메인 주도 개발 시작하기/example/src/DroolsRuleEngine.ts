export class DroolsRuleEngine {
  private readonly kContainer: KieContainer;

  constructor() {
    const ks = KieServices.Factory.get();
    this.kContainer = ks.getKieClasspathContainer();
  }

  evalute(sessionName: string, facts: unknown[]) {
    const kSession = this.kContainer.newKieSession(sessionName);

    try {
      facts.forEach((x) => kSession.insert(x));
      kSession.fireAllRules();
    } finally {
      kSession.dispose();
    }
  }
}
