const employess = ["직원A", "직원B", "직원C"];
const basePays = [400, 300, 250];

/**
 * 사용자로부터 소득세율을 입력받는다
 *   "세율을 입력하세요 :" 라는 문장을 화면에 출력한다
 *   키보드를 통해서 세율을 입력받는다
 */
const getTaxRate = () => {
  console.log("세율을 입력하세요 :");
  return 0.1;
};

/**
 * 직원의 급여를 계산한다
 *   전역 변수에 저장된 직원의 기본급 정보를 얻는다
 *   급여를 계산한다
 */
const calculatePaytFor = (name: string, taxRate: number) => {
  return basePays[employess.indexOf(name)] * (1 - taxRate);
};

/**
 * 양식에 맞게 결과를 출력한다
 *    "이름: {직원명}, 급여: {금액}" 형식에 따라서 출력 문자열을 생성한다
 */
const describeResult = (name: string, pay: number) => {
  return `이름: ${name}, 급여: ${pay}`;
};

/**
 * 직원이 급여를 계산한다
 *    사용자로부터 소득세율을 입력받는다
 *    직원의 급여를 계산한다
 *    양식에 맞게 결과를 출력한다
 */
export const main = (name: string) => {
  const taxRate = getTaxRate();
  const pay = calculatePaytFor(name, taxRate);
  console.log(describeResult(name, pay));
};

main("직원A");
