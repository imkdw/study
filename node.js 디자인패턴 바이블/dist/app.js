"use strict";
const users = [
    { id: 1, name: "ID", age: 20 },
    { id: 2, name: "ID", age: 20 },
    { id: 3, name: "ID", age: 20 },
    { id: 4, name: "ID", age: 20 },
    { id: 5, name: "ID", age: 20 },
    { id: 6, name: "ID", age: 20 },
    { id: 7, name: "ID", age: 20 },
    { id: 8, name: "ID", age: 20 },
    { id: 9, name: "ID", age: 20 },
    { id: 10, name: "ID", age: 20 },
];
const tempUsers = [];
for (let i = 0; i < users.length; i++) {
    if (users[i].age < 30) {
        tempUsers.push(users[i]);
    }
}
console.log(tempUsers.length);
