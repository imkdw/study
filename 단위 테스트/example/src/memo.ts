/**
 * 출력 : number
 * 이름 : calculateDiscount
 * 입력 : Product[]
 * 메소드 시그니처 : calculateDiscount(products: Product[]): number
 */
const calculateDiscount = (products: Product[]): number => {
  const discount = products.length * 0.01;
  return Math.min(discount, 0.02);
};
