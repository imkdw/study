type UserId = `user_${number}`;
type SessionToken = string;

type User = {
  id: UserId;
  username: string;
  name: string;
};

type Database = {
  users: Record<UserId, User>;
  sessions: Record<SessionToken, UserId>;
};

export const database: Database = {
  users: {
    user_1: {
      id: "user_1",
      username: "dongwoo",
      name: "김동우",
    },
  },
  sessions: {},
};
