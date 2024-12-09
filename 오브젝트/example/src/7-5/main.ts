class Employeee {
  private name: string;
  protected basePay: number;

  constructor(name: string, basePay: number) {
    this.name = name;
    this.basePay = basePay;
  }
}

class SalariedEmployee extends Employeee {
  constructor(name: string, basePay: number) {
    super(name, basePay);
  }

  calculatePay(taxRate: number) {
    return this.basePay * (1 - taxRate);
  }

  monthlyBasePay() {
    return this.basePay;
  }
}

class HourlyEmployee extends Employeee {
  private timeCard: number;

  constructor(name: string, basePay: number, timeCard: number) {
    super(name, basePay);
    this.timeCard = timeCard;
  }

  calculatePay(taxRate: number) {
    return this.basePay * this.timeCard * (1 - taxRate);
  }

  monthlyBasePay() {
    return 0;
  }
}

const employees = [
  new SalariedEmployee("A", 1000),
  new HourlyEmployee("B", 1000, 10),
  new SalariedEmployee("C", 1000),
  new HourlyEmployee("D", 1000, 10),
];

const sumOfBasePays = () => {
  let result = 0;
  for (const employee of employees) {
    result += employee.monthlyBasePay();
  }

  return result;
};
