export const isStringLong = (str: string): boolean => {
  const result = str.length > 5;
  const wasLastStringLong = result;
  return result;
};

export const parse = (str: string): number => {
  return parseInt(str, 10);
};
