const argon2 = require("argon2");

(async () => {
  const password = "Admin@123"; 
  const hash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16, // 64MB
    timeCost: 3,
    parallelism: 1,
  });
  console.log(hash);
})();