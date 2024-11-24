export const createUser = (data: object[]) => {
  const id = data[0];
  const email = data[1];
  const type = data[2];

  return new User(id, email, type);
};
