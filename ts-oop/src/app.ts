import { Discount, PremiumCustomer } from "./ocp/customer";

const premiumCustomer = new PremiumCustomer();
const discount = new Discount();
console.log(discount.giveDiscount(premiumCustomer)); // 20
