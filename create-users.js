
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { initDatabase, userDB } = require('./database');

async function main() {
  await initDatabase();
  const users = [
    { username: 'admin', password: 'admin123'},
    { username: 'jota', password: 'jota2026'},
    { username: 'teste', password: 'teste2026'},
  ];
  for (const user of users) {
    try {
      await userDB.create(user.username, user.password, user.email);
      console.log(`Usuário criado: ${user.username}`);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        console.log(`Usuário já existe: ${user.username}`);
      } else {
        console.error(`Erro ao criar ${user.username}:`, err.message);
      }
    }
  }
  process.exit(0);
}

main();
