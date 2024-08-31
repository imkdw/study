"use strict";
const promises = [Promise.resolve(1), Promise.resolve(2), Promise.resolve(3), Promise.reject(new Error("error"))];
Promise.allSettled(promises).then((results) => {
    console.log(results);
});
