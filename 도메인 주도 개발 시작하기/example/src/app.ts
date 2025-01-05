import { CalculateDiscountService } from "./CalculateDiscountService.js";
import { DroolsRuleDiscounter } from "./DroolsRuleDiscounter.js";

const ruleDiscounter = new DroolsRuleDiscounter();
const disService = new CalculateDiscountService(ruleDiscounter);
