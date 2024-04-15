/**
 * 프로토타입 패턴
 *
 * 객체를 생성하는데 많은 비용이 들고 비슷한 객체가 있을경우 사용되는 생성패턴
 *
 * 원본 객체를 새로운 객체에 복사해서 필요에 따라 수정함
 */
interface UserDetails {
  name: string;
  age: number;
  email: string;
}

interface Prototype {
  clone(): Prototype;
  getUserDetails(): UserDetails;
}

class COncreatePrototype implements Prototype {
  constructor(private user: UserDetails) {}

  clone(): Prototype {
    const clone = Object.create(this);
    clone.user = { ...this.user };
    return clone;
  }

  getUserDetails(): UserDetails {
    return this.user;
  }
}

const user1 = new COncreatePrototype({
  name: "John",
  age: 32,
  email: "email@email.com",
});

const user2 = user1.clone();

if (user1 === user2) {
  console.log("Both objects are same");
} else {
  console.log("Both objects are different");
}

const a = { age: 1 };
const b = { ...a };
console.log(a === b);
